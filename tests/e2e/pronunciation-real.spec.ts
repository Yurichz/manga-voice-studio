import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID,randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { storage } from '../../packages/storage/src/index.js';

test('real editor previews server numbers, saves manual pronunciation and restores it after reload',async({page})=>{
 test.skip(process.env.MVS_RUN_INTEGRATION!=='true','Explicitly enable the real PostgreSQL/API check');
 const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');let ownerId='',projectId='';
 try{
  ownerId=(await makeAuth(true).api.signUpEmail({body:{name:'Pronunciation browser fixture',email,password}})).user.id;
  const project=await db.project.create({data:{textLanguage:'ru',speechLanguage:'Russian',ownerId,title:'Произношение '+randomUUID().slice(0,8)}});projectId=project.id;
  const chapter=await db.chapter.create({data:{projectId,title:'Числа',order:0}}),imageKey=projectId+'/test.png';
  await storage.write(imageKey,await fs.readFile('work/fixtures/chapter-1.png'));
  const p=await db.page.create({data:{projectId,chapterId:chapter.id,order:0,name:'test.png',width:800,height:1000,imageKey,previewKey:imageKey,sourceKey:imageKey,checksum:'owned-fixture',transform:{}}});
  const u=await db.utterance.create({data:{id:randomUUID(),projectId,pageId:p.id,bbox:{x:.1,y:.1,width:.3,height:.2},order:0,kind:'narration',originalText:'2016 год.',spokenText:'2016 год.',included:false,reviewStatus:'reviewed'}});
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const open=async()=>{await page.getByRole('button',{name:project.title}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapter.id);await page.getByRole('button',{name:'1 · test.png'}).click();await page.locator('rect[data-id="'+u.id+'"]').click({position:{x:10,y:10}});};
  await open();await expect(page.getByLabel('Prepared text',{exact:true})).toHaveText('Две тысячи шестнадцатый год.');
  const manual='Если упо́рно тренироваться, можно стать и в 7 раз сильнее...';
  await page.getByLabel('Spoken text',{exact:true}).fill(manual);
  await expect(page.getByLabel('Prepared text',{exact:true})).toHaveText('Если упо́рно тренироваться, можно стать и в семь раз сильнее...');
  await expect(page.getByText('VoxCPM2 stress control using annotations has not yet been verified by listening.',{exact:true})).toBeVisible();
  expect(await db.utterance.findUnique({where:{id:u.id}})).toMatchObject({spokenText:manual,originalText:'2016 год.'});
  await page.reload();await open();await expect(page.getByLabel('Spoken text',{exact:true})).toHaveValue(manual);await expect(page.getByLabel('Prepared text',{exact:true})).toContainText('в семь раз');
  await page.getByLabel('Spoken text',{exact:true}).fill('Код 2016.');await expect(page.getByLabel('Prepared text',{exact:true})).toHaveText('Код 2016.');await expect(page.getByText(/Check how to read “2016”/)).toBeVisible();
  await fs.mkdir('work/pronunciation',{recursive:true});await page.screenshot({path:'work/pronunciation/editor.png',fullPage:true});
 }finally{
  if(projectId){await db.utterance.deleteMany({where:{projectId}});await db.page.deleteMany({where:{projectId}});await db.project.delete({where:{id:projectId}});await storage.removeProject(projectId);}
  if(ownerId)await db.user.delete({where:{id:ownerId}});await db.$disconnect();
 }
});
