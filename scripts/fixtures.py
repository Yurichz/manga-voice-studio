from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def fixtures():
 target=ROOT/'work/fixtures';target.mkdir(parents=True,exist_ok=True)
 font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',30)
 for index in range(1,3):
  image=Image.new('RGB',(800,1000),'#fbfbf5');d=ImageDraw.Draw(image)
  d.rectangle((20,20,780,480),outline='black',width=5);d.rectangle((20,520,780,980),outline='black',width=5)
  d.ellipse((90,210,230,350),fill='#b6a4e8',outline='black',width=4);d.rectangle((100,340,220,450),fill='#5d5680')
  d.ellipse((540,730,680,870),fill='#8cbcaf',outline='black',width=4);d.rectangle((550,860,670,960),fill='#3a685a')
  d.rounded_rectangle((300,90,740,210),radius=25,fill='white',outline='black',width=3);d.text((320,120),'Привет! Начнём историю.' if index==1 else 'Мы снова встретились.',font=font,fill='black')
  d.rounded_rectangle((70,590,510,710),radius=25,fill='white',outline='black',width=3);d.text((90,620),'Я готов идти дальше.' if index==1 else 'Наш путь продолжается.',font=font,fill='black')
  image.save(target/f'chapter-{index}.png')
 return target
if __name__=='__main__':print(fixtures())
