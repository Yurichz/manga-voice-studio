"""Deterministic Russian number preparation. Never repairs OCR or guesses codes."""
import re
from decimal import Decimal
from num2words import num2words

VERSION='ru-numbers-v1'
YEAR_CASES={'год':'nominative','года':'genitive','году':'prepositional','годом':'instrumental','годе':'prepositional'}
# Consume compound numeric forms whole so a date/code is never partly rewritten.
NUMBER=re.compile(r'(?<![\w\u0301])[+−-]?\d+(?:(?:[.,:/–—-]|[ \u00a0\u202f](?=\d{3}(?:\D|$)))\d+)*(?:[%‰]|[A-Za-zА-Яа-яЁё][\w-]*)?(?![\w\u0301])')
YEAR=re.compile(r'\s+(годом|года|году|годе|год)\b',re.I)

def sentence_case(text):
 if re.search('[А-ЯЁ]',text) and not re.search('[а-яё]',text):
  text=re.sub('[А-ЯЁ]',lambda m:m[0].lower(),text)
  text=re.sub(r'(^|[.!?…][\s«"\x27(]*)([а-яё])',lambda m:m[1]+m[2].upper(),text)
 return text

def prepare_speech_text(text,language):
 if not isinstance(text,str) or len(text)>10000:raise ValueError('Текст должен содержать не более 10000 символов')
 if not isinstance(language,str) or not 2<=len(language)<=30:raise ValueError('Некорректный язык речи')
 warnings=[]
 if language.lower() not in ['ru','russian']:
  return {'synthesisText':text,'textPreparationVersion':VERSION,'warnings':warnings}
 text=sentence_case(text)
 def replace(match):
  token=match[0];after=text[match.end():];before=text[:match.start()]
  year=YEAR.match(after)
  # Only simple signed integers/decimals are automatic. Preserve all other tokens.
  ambiguous=not re.fullmatch(r'[−-]?\d+(?:[.,]\d+)?',token)
  digits=token.lstrip('−-').split(',')[0].split('.')[0]
  ambiguous=ambiguous or len(digits)>9 or (len(digits)>1 and digits.startswith('0'))
  ambiguous=ambiguous or bool(re.match(r'\s*(?:%|‰|[кКмМ]?₽|руб\.|г\.|кг\b|км\b|см\b|мг\b|мл\b|[A-Za-z])',after))
  ambiguous=ambiguous or bool(re.match(r'-[А-Яа-яЁё]',after))
  ambiguous=ambiguous or bool(re.search(r'(?:№\s*|[\w][-/]|(?:код|номер|телефон|артикул|серия)\s*[:№]?\s*)$',before,re.I))
  ambiguous=ambiguous or bool(re.search(r'\b(?:дата|версия)\s*:?\s*$',before,re.I))
  # A separated range/sign, fraction or version must not lose its separator semantics.
  ambiguous=ambiguous or bool(re.search(r'\d\s*[-–—/:+]\s*$',before) or re.match(r'\s*[-–—/:+]\s*\d',after))
  if ambiguous:
   warnings.append(f'Проверьте чтение «{token}»: дата, код, диапазон или сокращение. При необходимости запишите словами в поле «Произносимый текст».')
   return token
  try:
   value=token.replace('−','-').replace(',','.')
   if year and '.' not in value and 1000<=int(value)<=9999:
    case=YEAR_CASES[year[1].lower()]
    if year[1].lower()=='году' and re.search(r'\bк\s*$',before,re.I):case='dative'
    words=num2words(int(value),lang='ru',to='ordinal',case=case)
   elif '.' in value:
    if len(value.split('.')[1])>6:raise ValueError('Слишком много десятичных знаков')
    words=num2words(Decimal(value),lang='ru')
   else:
    # Explicit, common inflections; other grammatical contexts remain user-editable.
    case='nominative'
    if re.search(r'\b(?:из|от|до|без|около|после|больше|меньше)\s*$',before,re.I):case='genitive'
    elif re.search(r'\bк\s*$',before,re.I):case='dative'
    elif re.search(r'\b(?:с|между)\s*$',before,re.I):
     warnings.append(f'Проверьте падеж числа «{token}» после предлога; при необходимости запишите его словами.')
     return token
    gender='feminine' if re.match(r'\s+(?:секунд[аыу]?|минут[аыу]?|книг[аиу]?|страниц[аыу]?)\b',after,re.I) else 'masculine'
    words=num2words(int(value),lang='ru',case=case,gender=gender)
   return words[0].upper()+words[1:] if not before.strip() or re.search(r'[.!?…]\s*$',before) else words
  except (ValueError,OverflowError,NotImplementedError):
   warnings.append(f'Проверьте чтение числа «{token}» и при необходимости запишите его словами.')
   return token
 result=NUMBER.sub(replace,text)
 if re.search(r'\d',result) and not warnings:warnings.append('В тексте остались цифры внутри слова или кода: проверьте произношение.')
 if '\u0301' in result or re.search(r'[А-Яа-яЁё]\+[А-Яа-яЁё]',result):warnings.append('Управление ударением пометками в VoxCPM2 пока не подтверждено прослушиванием.')
 if len(result)>10000:raise ValueError('После раскрытия чисел текст превышает 10000 символов. Разделите реплику.')
 return {'synthesisText':result,'textPreparationVersion':VERSION,'warnings':list(dict.fromkeys(warnings))}
