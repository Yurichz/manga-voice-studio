import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { test,expect } from '@playwright/test';
test('login is usable and services are same-origin',async({page,request})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Manga Voice Studio'})).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();expect((await request.get('/health/live')).status()).toBe(200);expect((await request.get('/api/v1/projects')).status()).toBe(401);});
test('manual project defaults to English and persists after reload',async({page,context})=>{
 const isolated=process.env.MVS_RUN_INTEGRATION==='true';
 test.skip(!isolated&&(!process.env.MVS_E2E_EMAIL||!process.env.MVS_E2E_PASSWORD),'An isolated database or explicit test owner is required');
 let email=process.env.MVS_E2E_EMAIL!,password=process.env.MVS_E2E_PASSWORD!,ownerId='',projectId='';
 if(isolated){
  expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/kelly_test_/);
  email=randomUUID()+'@mvs-test.invalid';password=randomBytes(24).toString('base64url');
  ownerId=(await makeAuth(true).api.signUpEmail({body:{name:'English project browser fixture',email,password}})).user.id;
 }
 try{
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Your projects'})).toBeVisible();
  const title='E2E '+Date.now(),created=page.waitForResponse(r=>r.url().endsWith('/api/v1/projects')&&r.request().method()==='POST');
  page.once('dialog',d=>d.accept(title));await page.getByRole('button',{name:'Create project'}).click();await expect(page.getByText('/ '+title)).toBeVisible();
  const project=await (await created).json();projectId=project.id;
  expect(project).toMatchObject({textLanguage:'en',speechLanguage:'English',readingDirection:'rtl'});
  await page.getByText('Languages and chapter direction',{exact:true}).click();
  await expect(page.getByLabel('Text language',{exact:true})).toHaveValue('en');
  await expect(page.getByLabel('Speech language',{exact:true})).toHaveValue('English');
  await page.reload();await expect(page.getByRole('button',{name:new RegExp(title)})).toBeVisible();
 }finally{
  if(projectId)await context.request.delete('/api/v1/projects/'+projectId,{headers:{Origin:'http://localhost:3000'}});
  if(ownerId){await db.project.deleteMany({where:{ownerId}});await db.user.delete({where:{id:ownerId}});}
  await db.$disconnect();
 }
});
