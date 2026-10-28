import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID,randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { storage } from '../../packages/storage/src/index.js';

test('real authenticated browser deletes a selection and all remaining pages, persisting after reload',async({page})=>{
 test.skip(process.env.MVS_RUN_INTEGRATION!=='true','Explicitly enable the real PostgreSQL/API check');
 const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');let ownerId='',projectId='';
 try{
  const account=await makeAuth(true).api.signUpEmail({body:{name:'Bulk deletion browser fixture',email,password}});ownerId=account.user.id;
  const project=await db.project.create({data:{ownerId,title:'Проверка multiple delete '+randomUUID().slice(0,8)}});projectId=project.id;
  const chapter=await db.chapter.create({data:{projectId,title:'Тестовая глава',order:0}}),imageKey=projectId+'/test.png';
  await storage.write(imageKey,await fs.readFile('work/fixtures/chapter-1.png'));
  const pages=[];for(let order=0;order<3;order++)pages.push(await db.page.create({data:{projectId,chapterId:chapter.id,order,name:`${order+1}.png`,width:800,height:1000,imageKey,previewKey:imageKey,sourceKey:imageKey,checksum:'owned-fixture',transform:{}}}));
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:project.title}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapter.id);
  await page.getByRole('button',{name:'1 · 1.png'}).click();await expect(page.getByLabel('Page annotations')).toBeVisible();
  await page.getByLabel('Select page 1 · 1.png',{exact:true}).check();await page.getByLabel('Select page 3 · 3.png',{exact:true}).check();
  page.once('dialog',async dialog=>dialog.accept());const deleted=page.waitForResponse(r=>r.url().endsWith('/chapters/'+chapter.id+'/pages')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'Delete selected (2)',exact:true}).click();
  const response=await deleted;expect(response.status()).toBe(200);expect(await response.json()).toMatchObject({deletedCount:2});await expect(page.getByRole('button',{name:'1 · 2.png'})).toBeVisible();
  expect((await db.page.findMany({where:{chapterId:chapter.id}})).map(p=>[p.id,p.order])).toEqual([[pages[1].id,0]]);
  await page.reload();await page.getByRole('button',{name:project.title}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapter.id);await expect(page.getByLabel(/^Select page /)).toHaveCount(1);
  await page.getByLabel('Select all pages').check();page.once('dialog',async dialog=>dialog.accept());const deletedAll=page.waitForResponse(r=>r.url().endsWith('/chapters/'+chapter.id+'/pages')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();expect((await deletedAll).status()).toBe(200);await expect(page.getByLabel(/^Select page /)).toHaveCount(0);await expect(page.getByLabel('Select all pages')).toBeDisabled();
  expect(await db.page.count({where:{chapterId:chapter.id}})).toBe(0);
  await page.reload();await page.getByRole('button',{name:project.title}).click();await page.getByLabel('Chapter',{exact:true}).selectOption(chapter.id);await expect(page.getByLabel('Select all pages')).toBeDisabled();
 }finally{
  if(projectId){await db.utterance.deleteMany({where:{projectId}});await db.page.deleteMany({where:{projectId}});await db.project.delete({where:{id:projectId}});await storage.removeProject(projectId);}
  if(ownerId)await db.user.delete({where:{id:ownerId}});
  await db.$disconnect();
 }
});
