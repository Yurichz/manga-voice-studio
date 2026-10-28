import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
test('manual editor creates and saves normalized rectangles (explicit mock API)',async({page})=>{
 const projectId=randomUUID(),chapterId=randomUUID(),pageId=randomUUID();let revision=0;let panels:any[]=[],utterances:any[]=[];let saves=0;
 const record=()=>({id:pageId,projectId,chapterId,order:0,name:'Тест',width:800,height:1000,imageKey:projectId+'/test.png',previewKey:projectId+'/test.png',revision,panels,utterances});
 await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url());const p=url.pathname.replace('/api/v1','');let result:any=[];if(p==='/me')result={ownerId:'test',demo:false};else if(p==='/projects')result=[{id:projectId,title:'Тестовый проект'}];else if(p==='/projects/'+projectId)result={id:projectId,title:'Тестовый проект',revision:0,readingDirection:'rtl',chapters:[{id:chapterId,title:'Глава'}],characters:[],voices:[]};else if(p==='/chapters/'+chapterId)result={id:chapterId,revision:0,pages:[record()],renders:[]};else if(p==='/pages/'+pageId){if(route.request().method()==='PUT'){const body=route.request().postDataJSON();expect(body.expectedRevision).toBe(revision);panels=body.panels;utterances=body.utterances.map((u:any)=>({...u,revision:revision+1}));revision++;saves++;}result=record();}else if(p.endsWith('/pronunciation')){const u=utterances.find(u=>p.includes(u.id));result={utteranceId:u.id,utteranceRevision:u.revision,spokenText:u.spokenText,synthesisText:u.spokenText==='Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ.'?'Я тут думать пытаюсь, не мешай.':u.spokenText,textPreparationVersion:'ru-numbers-v1',warnings:[]};}else if(p.startsWith('/files/')){await route.fulfill({path:path.resolve('work/fixtures/chapter-1.png'),contentType:'image/png'});return;}else if(p==='/health')result={api:'ready',database:'test adapter'};await route.fulfill({json:result});});
 await page.goto('/');await page.getByRole('button',{name:'Тестовый проект'}).click();await page.getByLabel('Глава',{exact:true}).selectOption(chapterId);await page.getByRole('button',{name:'1 · Тест'}).click();await page.getByRole('button',{name:'Реплика',exact:true}).click();const box=await page.getByLabel('Разметка страницы').boundingBox();expect(box).not.toBeNull();await page.mouse.move(box!.x+box!.width*.2,box!.y+box!.height*.2);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.6,box!.y+box!.height*.35);await page.mouse.up();await page.getByLabel('Произносимый текст',{exact:true}).fill('Проверка русского текста.');await expect.poll(()=>saves).toBeGreaterThan(0);await expect.poll(()=>utterances[0]?.spokenText).toBe('Проверка русского текста.');expect(utterances[0].bbox.x).toBeCloseTo(.2,1);expect(utterances[0].bbox.width).toBeCloseTo(.4,1);await page.getByLabel('Произносимый текст',{exact:true}).fill('Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ.');await expect(page.getByText('Я тут думать пытаюсь, не мешай.',{exact:true})).toBeVisible();await expect.poll(()=>utterances[0]?.spokenText).toBe('Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ.');await fs.mkdir('outputs/ui',{recursive:true});await page.screenshot({path:'outputs/ui/editor.png',fullPage:true});
});
test('a saved tab preserves and recovers the other tab conflict draft (explicit mock API)',async({page,context})=>{
 const projectId=randomUUID(),chapterId=randomUUID(),pageId=randomUUID(),utteranceId=randomUUID();let revision=0;
 let utterances:any[]=[{id:utteranceId,panelId:null,bbox:{x:.1,y:.1,width:.3,height:.2},order:0,kind:'dialogue',originalText:'Текст',spokenText:'Текст',characterId:null,voiceVersionId:null,pauseMs:300,included:false,reviewStatus:'reviewed',revision:0}];
 const record=()=>({id:pageId,projectId,chapterId,order:0,name:'Тест',width:800,height:1000,imageKey:projectId+'/test.png',previewKey:projectId+'/test.png',revision,panels:[],utterances});
 await context.route('**/api/v1/**',async route=>{
  const p=new URL(route.request().url()).pathname.replace('/api/v1','');let result:any=[];
  if(p==='/me')result={ownerId:'test',demo:false};
  else if(p==='/projects')result=[{id:projectId,title:'Два окна'}];
  else if(p==='/projects/'+projectId)result={id:projectId,title:'Два окна',revision:0,readingDirection:'rtl',chapters:[{id:chapterId,title:'Глава'}],characters:[],voices:[]};
  else if(p==='/chapters/'+chapterId)result={id:chapterId,revision:0,pages:[record()],renders:[]};
  else if(p==='/pages/'+pageId){
   if(route.request().method()==='PUT'){
    if(route.request().frame().page()===page){await route.fulfill({status:409,json:{error:{message:'Конфликт версии'}}});return;}
    utterances=route.request().postDataJSON().utterances;revision++;
   }result=record();
  }else if(p.startsWith('/files/')){await route.fulfill({path:path.resolve('work/fixtures/chapter-1.png'),contentType:'image/png'});return;}
  await route.fulfill({json:result});
 });
 const open=async(p:typeof page)=>{await p.goto('/');await p.getByRole('button',{name:/^Два окна/}).click();await p.getByLabel('Глава',{exact:true}).selectOption(chapterId);await p.getByRole('button',{name:/1 · Тест/}).click();await p.locator('rect[data-id="'+utteranceId+'"]').click({position:{x:10,y:10}});};
 const second=await context.newPage();await open(page);await open(second);
 await page.getByLabel('Произносимый текст',{exact:true}).fill('Мой конфликтный черновик');await expect(page.getByRole('button',{name:'Сохранить мой черновик поверх текущей версии'})).toBeVisible();
 await second.getByLabel('Произносимый текст',{exact:true}).fill('Сохранено в другой вкладке');await expect.poll(()=>utterances[0].spokenText).toBe('Сохранено в другой вкладке');await expect(second.getByText('Сохранено',{exact:true})).toBeVisible();
 expect(await second.evaluate(id=>Object.keys(localStorage).filter(k=>k.startsWith('mvs-draft-'+id)).map(k=>JSON.parse(localStorage.getItem(k)!)),pageId)).toEqual([expect.objectContaining({content:expect.objectContaining({utterances:[expect.objectContaining({spokenText:'Мой конфликтный черновик'})]})})]);
 page.once('dialog',d=>d.accept());await open(page);await page.getByRole('button',{name:'Восстановить черновик',exact:true}).click();await expect(page.getByLabel('Произносимый текст',{exact:true})).toHaveValue('Мой конфликтный черновик');await second.close();
});
