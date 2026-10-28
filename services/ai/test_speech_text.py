import socket
import pytest
from services.ai.speech_text import prepare_speech_text

@pytest.mark.parametrize('source,expected',[
 ('2016 год по Календарю Вампиров.','Две тысячи шестнадцатый год по Календарю Вампиров.'),
 ('В 2016 году.','В две тысячи шестнадцатом году.'),
 ('С 2016 года.','С две тысячи шестнадцатого года.'),
 ('К 2016 году.','К две тысячи шестнадцатому году.'),
 ('Это был 2000 год.','Это был двухтысячный год.'),
 ('ЕСЛИ УПОРНО ТРЕНИРОВАТЬСЯ, МОЖНО СТАТЬ И В 7 РАЗ СИЛЬНЕЕ...','Если упорно тренироваться, можно стать и в семь раз сильнее...'),
 ('Ноль: 0, плюс 15 и минус -3.','Ноль: ноль, плюс пятнадцать и минус минус три.'),
 ('Было 3,5 яблока и 0.05 литра.','Было три целых пять десятых яблока и ноль целых пять сотых литра.'),
 ('До 7 раз.','До семи раз.'),
 ('Осталась 1 минута.','Осталась одна минута.'),
 ('2016 год. 7 раз!','Две тысячи шестнадцатый год. Семь раз!'),
 ('Прошло 2 года.','Прошло два года.'),
])
def test_known_numbers(source,expected):
 result=prepare_speech_text(source,'Russian')
 assert result=={'synthesisText':expected,'textPreparationVersion':'ru-numbers-v1','warnings':[]}

@pytest.mark.parametrize('text',['Дата 04.10.2016.','Дата 10.12.','В 12:30.','Код 2016.','007','AB2016','2016 г.','10 кг','1/2','3-5','3 — 5','10%','Версия 1.2.3','10000000000','1 000','№ 25','7-й класс'])
def test_ambiguous_numeric_forms_are_preserved_and_warn(text):
 result=prepare_speech_text(text,'Russian');assert result['synthesisText']==text;assert result['warnings']


def test_warning_language_is_english_while_russian_content_is_preserved():
 result=prepare_speech_text('Код 2016.','Russian')
 assert result['synthesisText']=='Код 2016.'
 assert result['warnings']==['Check how to read “2016”: a date, code, range or abbreviation. Write it out in the Spoken text field if needed.']


@pytest.mark.parametrize('text,language,message',[
 ('x'*10001,'English','Text must contain no more than 10000 characters'),
 ('Text','x','Invalid speech language'),
])
def test_validation_errors_are_english(text,language,message):
 with pytest.raises(ValueError,match=message):prepare_speech_text(text,language)

def test_manual_text_and_non_russian_are_preserved_offline(monkeypatch):
 def blocked(*_args,**_kwargs):raise AssertionError('Text preparation must be offline')
 monkeypatch.setattr(socket,'socket',blocked);monkeypatch.setattr(socket,'getaddrinfo',blocked)
 for language in ['English','Japanese']:
  assert prepare_speech_text('Year 2016. 3.5 and 7.',language)['synthesisText']=='Year 2016. 3.5 and 7.'
 for text in ['Если упо́рно тренироваться!','Если уп+орно тренироваться!','Если упОрно тренироваться!','Не исправляй упороно.']:
  assert prepare_speech_text(text,'ru')['synthesisText']==text
 assert prepare_speech_text('2016 год','ru')['synthesisText']=='Две тысячи шестнадцатый год'
 with pytest.raises(ValueError):prepare_speech_text('7 '*5000,'ru')
