import { test,expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
test('isolated demo reads real audio and rejects mutation',async({page,request})=>{
 test.skip(process.env.MVS_DEMO_TEST!=='true','Run with the isolated demo API');await page.goto('/');await expect(page.getByRole('heading',{name:'Ваши произведения'})).toBeVisible();await expect(page.getByRole('button',{name:'Создать проект'})).toBeDisabled();await page.getByRole('button',{name:/Первые шаги/}).click();await page.getByLabel('Глава',{exact:true}).selectOption({label:'Демонстрационная глава'});await page.getByRole('button',{name:/1 · Собственная/}).click();await expect(page.locator('footer audio')).toBeVisible();const project=(await (await request.get('/api/v1/projects')).json())[0];const details=await (await request.get('/api/v1/projects/'+project.id)).json();const second=details.chapters[0].renders[0].manifest.segments[1];await page.getByLabel('Скорость воспроизведения').selectOption('1.5');await expect.poll(()=>page.locator('footer audio').evaluate((a:HTMLAudioElement)=>a.playbackRate)).toBe(1.5);await page.locator('footer audio').evaluate((a:HTMLAudioElement,time:number)=>{a.currentTime=time;a.dispatchEvent(new Event('timeupdate'));},second.startMs/1000+.1);await expect(page.locator('rect[data-id="'+second.utteranceId+'"]')).toHaveAttribute('stroke','#ffd766');expect((await request.post('/api/v1/projects',{data:{title:'Rejected'}})).status()).toBe(403);expect((await request.get('/api/v1/files/secret/private.wav')).status()).toBe(404);await page.screenshot({path:'outputs/ui/demo.png',fullPage:true});
});
test('demo refuses import, speech and edits on the server',async({request})=>{
 test.skip(process.env.MVS_DEMO_TEST!=='true','Run with the isolated demo API');
 const project=(await (await request.get('/api/v1/projects')).json())[0],chapter=project.chapters[0];
 expect(await (await request.get('/api/v1/projects/'+project.id+'/job-progress')).json()).toEqual({jobs:[],batches:[]});
 expect((await request.get('/api/v1/projects/foreign/job-progress')).status()).toBe(404);
 const imported=await request.post('/api/v1/chapters/'+chapter.id+'/import',{multipart:{files:{name:'forbidden.png',mimeType:'image/png',buffer:await fs.readFile('work/fixtures/chapter-1.png')}}});
 expect(imported.status()).toBe(403);expect((await imported.json()).error.code).toBe('DEMO_READ_ONLY');
 for(const path of ['/chapters/'+chapter.id+'/speech','/chapters/'+chapter.id+'/render','/projects/'+project.id+'/voices/design']){
  const r=await request.post('/api/v1'+path,{data:{}});expect(r.status()).toBe(403);expect((await r.json()).error.code).toBe('DEMO_READ_ONLY');
 }
 expect((await request.patch('/api/v1/projects/'+project.id,{data:{title:'Rejected'}})).status()).toBe(403);
});
