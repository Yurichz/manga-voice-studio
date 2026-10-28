import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { speechModel,voxSettings } from '@mvs/contracts';
test('manual job popup, progress counters, stale state, focus and reload — explicit API fixture',async({page})=>{
 const projectId=randomUUID(),jobId=randomUUID(),batchId=randomUUID();let status='running',offline=false,requests=0;
 const jobs=()=>({jobs:[{id:jobId,batchId,kind:'speech',status,stage:status==='succeeded'?'complete':'generating',progress:{phase:status==='succeeded'?'complete':'generating',completedPhases:['queued','preparing','loading_model','preparing_voice'],...(status==='running'?{completed:2,total:5,unit:'chunks'}:{}),updatedAt:new Date().toISOString()},createdAt:new Date(Date.now()-12000).toISOString(),updatedAt:new Date().toISOString(),attempts:1,error:null,result:null,synthesis:{...speechModel,generationSettings:{...voxSettings,seed:42},cloningMode:'reference-only',synthesisText:'Я тут думать пытаюсь, не мешай.',textPreparationVersion:'ru-caps-v1'}}],batches:[{id:batchId,total:20,succeeded:status==='succeeded'?20:8,failed:0,cancelled:0,active:status==='succeeded'?0:12,remaining:3}]});
 await page.route('**/api/v1/**',async route=>{const p=new URL(route.request().url()).pathname.replace('/api/v1','');let result:any=[];
  if(p==='/me')result={ownerId:'fixture',demo:false};
  else if(p==='/projects')result=[{id:projectId,title:'Прогресс'}];
  else if(p==='/projects/'+projectId)result={id:projectId,title:'Прогресс',revision:0,chapters:[],characters:[],voices:[]};
  else if(p.endsWith('/job-progress')){requests++;if(offline){await route.abort();return;}result=jobs();}
  await route.fulfill({json:result});
 });
 const openProject=async()=>{await page.getByRole('button',{name:/^Прогресс/}).click();await expect(page.getByRole('button',{name:'Задания (1)',exact:true})).toBeVisible();};
 await page.goto('/');await openProject();await expect(page.getByRole('dialog')).toHaveCount(0);
 const trigger=page.getByRole('button',{name:'Задания (1)',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Задания проекта'});
 await expect(dialog).toBeVisible();await expect(dialog.getByText('Генерация аудио · 2 из 5 фрагментов')).toBeVisible();await expect(dialog.getByText(/Готово 8 из 20 реплик/)).toBeVisible();await expect(dialog.getByText(/Ещё 3 реплик/)).toBeVisible();await expect(dialog.getByRole('progressbar',{name:'Прогресс: Озвучка',exact:true})).toHaveAttribute('value','2');
 await dialog.getByText('Модель и параметры озвучки',{exact:true}).click();await expect(dialog.getByText(speechModel.modelId,{exact:true})).toBeVisible();await expect(dialog.locator('pre')).toContainText('"seed": 42');
 await dialog.getByText('Текст и режим синтеза',{exact:true}).click();await expect(dialog.getByText('Я тут думать пытаюсь, не мешай.',{exact:true})).toBeVisible();await expect(dialog.getByText(/Голосовой референс без продолжения речи/)).toBeVisible();
 await page.screenshot({path:'outputs/voxcpm/progress-desktop.png'});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();const previous=requests;await expect.poll(()=>requests).toBeGreaterThan(previous);
 await trigger.click();offline=true;await expect(dialog.getByText(/Связь с сервером потеряна/)).toBeVisible({timeout:10000});await expect(dialog.getByText('Генерация аудио · 2 из 5 фрагментов')).toBeVisible();offline=false;status='succeeded';await expect(dialog.getByText('Последние результаты',{exact:true})).toBeVisible({timeout:10000});
 await page.reload();await page.getByRole('button',{name:/^Прогресс/}).click();await page.getByRole('button',{name:'Задания',exact:true}).click();await expect(page.getByRole('dialog').getByText(/Готово 20 из 20/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByText('Модель и параметры озвучки',{exact:true}).click();expect(await page.getByRole('dialog').evaluate(d=>d.getBoundingClientRect().width)).toBeLessThan(391);expect(await page.getByRole('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);await page.screenshot({path:'outputs/voxcpm/progress-mobile.png'});
});

test('sending a voice request is visible while busy and the manually opened popup remains open',async({page})=>{
 const projectId=randomUUID(),id=randomUUID();let release:()=>void=()=>{},accepted=false;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/v1/**',async route=>{const p=new URL(route.request().url()).pathname.replace('/api/v1','');let result:any=[];
  if(p==='/me')result={ownerId:'fixture',demo:false};else if(p==='/projects')result=[{id:projectId,title:'Отправка'}];else if(p==='/projects/'+projectId)result={id:projectId,title:'Отправка',chapters:[],characters:[],voices:[]};
  else if(p.endsWith('/voices/design')){await gate;accepted=true;result={jobId:id};}
  else if(p.endsWith('/job-progress'))result={jobs:accepted?[{id,batchId:null,kind:'voice_design',status:'queued',stage:'queued',progress:null,error:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),attempts:0,result:null}]:[],batches:[]};
  await route.fulfill({json:result});
 });
 await page.goto('/');await page.getByRole('button',{name:/^Отправка/}).click();await page.getByText('Персонажи и голоса',{exact:true}).click();await page.getByRole('button',{name:'Создать синтетический голос'}).click();await page.getByLabel('Название',{exact:true}).fill('Голос');await page.getByLabel('Описание собственного синтетического голоса').fill('Низкий мужской голос');await page.getByRole('button',{name:'Сгенерировать референс'}).click();await page.getByRole('button',{name:'Закрыть',exact:true}).click();const trigger=page.getByRole('button',{name:'Задания (1)',exact:true});await expect(trigger).toBeEnabled();await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog.getByText(/Отправка файлов \/ запроса/)).toBeVisible();release();await expect(dialog.locator('[data-job-id="'+id+'"]')).toBeVisible();await expect(dialog).toBeVisible();await expect(dialog.getByText(/Отправка файлов \/ запроса/)).toHaveCount(0);
});
