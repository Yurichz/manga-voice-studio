import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

test('visible page deletion requires confirmation and clears the editor (explicit mock API)',async({page})=>{
 const projectId=randomUUID(),chapterId=randomUUID(),pageId=randomUUID(),nextId=randomUUID(),utteranceId=randomUUID();let deletions=0;
 const record=(id:string,order:number)=>({id,projectId,chapterId,order,name:id===pageId?'Удаляемая.png':'Оставшаяся.png',width:800,height:1000,imageKey:projectId+'/test.png',previewKey:projectId+'/test.png',revision:7,panels:[],utterances:id===pageId?[{id:utteranceId,panelId:null,bbox:{x:.1,y:.1,width:.3,height:.2},order:0,kind:'dialogue',originalText:'Тест',spokenText:'Тест',characterId:null,voiceVersionId:null,pauseMs:300,included:false,reviewStatus:'reviewed',revision:0}]:[]});
 await page.route('**/api/v1/**',async route=>{
  const p=new URL(route.request().url()).pathname.replace('/api/v1','');let result:any=[];
  if(p==='/me')result={ownerId:'test',demo:false};
  else if(p==='/projects')result=[{id:projectId,title:'Удаление страниц'}];
  else if(p==='/projects/'+projectId)result={id:projectId,title:'Удаление страниц',revision:0,textLanguage:'ru',speechLanguage:'Russian',readingDirection:'rtl',chapters:[{id:chapterId,title:'Chapter'}],characters:[],voices:[]};
  else if(p==='/projects/'+projectId+'/job-progress')result={jobs:[],batches:[]};
  else if(p==='/chapters/'+chapterId)result={id:chapterId,revision:deletions,pages:deletions?[record(nextId,0)]:[record(pageId,0),record(nextId,1)],renders:[]};
  else if(p==='/pages/'+pageId&&route.request().method()==='DELETE'){expect(route.request().postDataJSON()).toEqual({expectedRevision:7,confirm:true});deletions++;result={deleted:true,cancelRequested:1};}
  else if(p==='/pages/'+pageId||p==='/pages/'+nextId)result=record(p.split('/').at(-1)!,0);
  else if(p.startsWith('/files/')){await route.fulfill({path:path.resolve('work/fixtures/chapter-1.png'),contentType:'image/png'});return;}
  await route.fulfill({json:result});
 });
 await page.goto('/');await page.getByRole('button',{name:'Удаление страниц'}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapterId);
 const remove=page.getByRole('button',{name:'Delete selected page'});await expect(remove).toBeVisible();await expect(remove).toBeDisabled();
 await page.getByRole('button',{name:'1 · Удаляемая.png'}).click();await expect(remove).toBeEnabled();
 await page.locator('rect[data-id="'+utteranceId+'"]').click({position:{x:10,y:10}});await expect(page.getByLabel('Spoken text',{exact:true})).toBeVisible();
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('Удаляемая.png');await dialog.dismiss();});await remove.click();expect(deletions).toBe(0);await expect(page.getByLabel('Page annotations')).toBeVisible();
 page.once('dialog',async dialog=>dialog.accept());await remove.click();await expect.poll(()=>deletions).toBe(1);
 await expect(page.getByLabel('Spoken text',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Page annotations')).toHaveCount(0);await expect(page.getByRole('button',{name:'1 · Оставшаяся.png'})).toBeVisible();await expect(remove).toBeDisabled();
 await page.getByRole('button',{name:'1 · Оставшаяся.png'}).click();await expect(page.getByLabel('Page annotations')).toBeVisible();
});

async function bulkFixture(page:Page,failFirst=false,demo=false){
 const projectId=randomUUID(),chapterId=randomUUID(),otherChapterId=randomUUID(),ids:string[]=[randomUUID(),randomUUID(),randomUUID()],utteranceId=randomUUID();let remaining=[...ids],calls=0;
 const record=(id:string,order:number)=>({id,projectId,chapterId,order,name:`Страница-${ids.indexOf(id)+1}.png`,width:800,height:1000,imageKey:projectId+'/test.png',previewKey:projectId+'/test.png',revision:7,panels:[],utterances:[{id:utteranceId,panelId:null,bbox:{x:.1,y:.1,width:.3,height:.2},order:0,kind:'dialogue',originalText:'Тест',spokenText:'Тест',characterId:null,voiceVersionId:null,pauseMs:300,included:false,reviewStatus:'reviewed',revision:0}]});
 await page.route('**/api/v1/**',async route=>{
  const p=new URL(route.request().url()).pathname.replace('/api/v1','');let result:any=[];
  if(p==='/me')result={ownerId:'test',demo};
  else if(p==='/projects')result=[{id:projectId,title:'Пакетное удаление'}];
  else if(p==='/projects/'+projectId)result={id:projectId,title:'Пакетное удаление',revision:0,textLanguage:'ru',speechLanguage:'Russian',readingDirection:'rtl',chapters:[{id:chapterId,title:'Chapter'},{id:otherChapterId,title:'Другая глава'}],characters:[],voices:[]};
  else if(p.endsWith('/job-progress'))result={jobs:[],batches:[]};
  else if(p==='/chapters/'+chapterId+'/pages'&&route.request().method()==='DELETE'){
   calls++;const body=route.request().postDataJSON();expect(body.confirm).toBe(true);expect(body.pages.every((p:any)=>p.expectedRevision===7)).toBe(true);expect(new Set(body.pages.map((p:any)=>p.id)).size).toBe(body.pages.length);
   if(failFirst&&calls===1){await route.fulfill({status:409,json:{error:{message:'The page revision changed'}}});return;}
   remaining=remaining.filter(id=>!body.pages.some((p:any)=>p.id===id));result={deleted:true,deletedCount:body.pages.length,cancelRequested:2};
  }
  else if(p==='/chapters/'+chapterId)result={id:chapterId,revision:calls,pages:remaining.map(record),renders:[]};
  else if(p==='/chapters/'+otherChapterId)result={id:otherChapterId,revision:0,pages:[],renders:[]};
  else if(p.startsWith('/pages/')&&ids.includes(p.split('/').at(-1)!))result=record(p.split('/').at(-1)!,remaining.indexOf(p.split('/').at(-1)!));
  else if(p.startsWith('/files/')){await route.fulfill({path:path.resolve('work/fixtures/chapter-1.png'),contentType:'image/png'});return;}
  await route.fulfill({json:result});
 });
 await page.goto('/');await page.getByRole('button',{name:'Пакетное удаление'}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapterId);
 return {chapterId,otherChapterId,utteranceId,calls:()=>calls};
}

test('bulk selection confirms once, deletes non-adjacent pages and can delete all remaining pages (explicit mock API)',async({page})=>{
 const fixture=await bulkFixture(page);
 await page.getByRole('button',{name:'1 · Страница-1.png'}).click();await expect(page.getByLabel('Page annotations')).toBeVisible();
 await page.getByLabel('Select page 1 · Страница-1.png',{exact:true}).check();await page.getByLabel('Select page 3 · Страница-3.png',{exact:true}).check();
 await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 2');expect(await page.getByLabel('Select all pages').evaluate((input:HTMLInputElement)=>input.indeterminate)).toBe(true);
 const remove=page.getByRole('button',{name:'Delete selected (2)',exact:true});
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('Страница-1.png');expect(dialog.message()).toContain('Страница-3.png');expect(dialog.message()).not.toContain('Страница-2.png');await dialog.dismiss();});await remove.click();expect(fixture.calls()).toBe(0);
 await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 2');
 await page.screenshot({path:'work/multiple-delete-desktop.png',fullPage:true});
 page.once('dialog',async dialog=>dialog.accept());await remove.click();await expect.poll(fixture.calls).toBe(1);
 await expect(page.getByLabel('Page annotations')).toHaveCount(0);await expect(page.getByRole('button',{name:'1 · Страница-2.png'})).toBeVisible();await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 0');
 await page.getByLabel('Select all pages').check();page.once('dialog',async dialog=>dialog.accept());await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();await expect.poll(fixture.calls).toBe(2);
 await expect(page.getByRole('button',{name:'Delete selected page'})).toBeDisabled();await expect(page.getByLabel('Select all pages')).toBeDisabled();await expect(page.getByLabel(/^Select page /)).toHaveCount(0);
});

test('bulk failure keeps selection and editor; retry preserves an unselected open page and chapter changes clear selection (explicit mock API)',async({page})=>{
 const fixture=await bulkFixture(page,true);
 await page.getByRole('button',{name:'2 · Страница-2.png'}).click();await expect(page.getByLabel('Page annotations')).toBeVisible();
 await page.locator(`rect[data-id="${fixture.utteranceId}"]`).click({position:{x:10,y:10}});
 await page.getByLabel('Select all pages').check();await page.getByLabel('Select page 2 · Страница-2.png',{exact:true}).uncheck();
 page.once('dialog',async dialog=>dialog.accept());await page.getByRole('button',{name:'Delete selected (2)',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'The page revision changed'})).toContainText('The page revision changed');
 await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 2');await expect(page.getByLabel(/^Select page /)).toHaveCount(3);await expect(page.getByLabel('Spoken text',{exact:true})).toHaveValue('Тест');
 page.once('dialog',async dialog=>dialog.accept());await page.getByRole('button',{name:'Delete selected (2)',exact:true}).click();await expect.poll(fixture.calls).toBe(2);
 await expect(page.getByLabel('Page annotations')).toBeVisible();await expect(page.getByLabel('Spoken text',{exact:true})).toHaveValue('Тест');await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 0');
 await page.getByLabel('Select all pages').check();await page.getByRole('button',{name:'Clear selection'}).click();await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 0');
 await page.getByLabel('Select all pages').focus();await page.keyboard.press('Space');await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 1');
 await page.getByLabel('Chapter',{exact:true}).selectOption(fixture.otherChapterId);await page.getByLabel('Chapter',{exact:true}).selectOption(fixture.chapterId);await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 0');
});

test('bulk controls fit mobile and are disabled in read-only demo (explicit mock API)',async({page})=>{
 await page.setViewportSize({width:390,height:844});await bulkFixture(page,false,true);
 await expect(page.getByLabel('Select all pages')).toBeDisabled();for(const checkbox of await page.getByLabel(/^Select page /).all())await expect(checkbox).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.unrouteAll({behavior:'wait'});const fixture=await bulkFixture(page);
 await page.getByLabel('Select all pages').check();await expect(page.locator('.page-selection').getByRole('status')).toHaveText('Selected: 3');
 await page.screenshot({path:'work/multiple-delete-mobile.png',fullPage:true});
 page.once('dialog',async dialog=>dialog.accept());await page.getByRole('button',{name:'Delete selected (3)',exact:true}).click();await expect.poll(fixture.calls).toBe(1);
 await expect(page.getByLabel(/^Select page /)).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
