import {promises as fs} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const origin='http://localhost:3000';
async function main(){
 const {cookie}=JSON.parse(await fs.readFile('work/publication-acceptance/session.json','utf8'));
 const fixture=JSON.parse(await fs.readFile('outputs/publication-acceptance/report.json','utf8'));
 async function api(url:string){const r=await fetch(origin+'/api/v1'+url,{headers:{Cookie:cookie}});if(!r.ok)throw new Error('Acceptance API failed: '+url+' '+r.status);return r.json();}
 const project=await api('/projects/'+fixture.projectId),preview=await api('/projects/'+fixture.projectId+'/publication-preview');
 if(preview.chapters.length!==2||preview.chapters.some((c:any)=>!c.ready))throw new Error('Real ready chapters are incorrectly blocked: '+JSON.stringify(preview));
 const browser=await chromium.launch();try{
  const context=await browser.newContext();await context.addCookies(cookie.split('; ').map((pair:string)=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
  const view=await context.newPage();await view.goto(origin);await view.getByRole('button',{name:project.title}).click();
  await view.getByRole('button',{name:'Экспорт для сайта',exact:true}).click();const dialog=view.getByRole('dialog',{name:'Экспорт для сайта'});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);for(const checkbox of await dialog.getByRole('checkbox').all())await expect(checkbox).toBeChecked();
  await dialog.getByRole('textbox',{name:'Описание',exact:true}).fill('Проверка готовности и экспорта через настоящий интерфейс редактора.');
  const response=view.waitForResponse(r=>r.url().endsWith('/publication-export')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Подготовить архив',exact:true}).click();const accepted=await response;if(!accepted.ok())throw new Error('Browser export submission failed');const {jobId}=await accepted.json();
  let job:any;for(let i=0;i<120;i++){job=await api('/jobs/'+jobId);if(job.status==='succeeded')break;if(['failed','blocked','cancelled'].includes(job.status))throw new Error('Browser export failed: '+JSON.stringify(job.error));await new Promise(r=>setTimeout(r,500));}
  if(job?.status!=='succeeded')throw new Error('Browser export timeout');await expect(dialog).not.toBeVisible();await view.getByRole('button',{name:/^Задания/}).click();await expect(view.getByRole('link',{name:'Скачать .mvs-publication.zip'}).first()).toBeVisible();
  const file=await fetch(origin+'/api/v1/files/'+job.result.fileKey,{headers:{Cookie:cookie}});if(!file.ok)throw new Error('Completed browser archive download failed');await fs.writeFile('outputs/publication-acceptance/latest-ui.mvs-publication.zip',Buffer.from(await file.arrayBuffer()));
  await fs.writeFile('outputs/publication-acceptance/ui-report.json',JSON.stringify({readyChapters:2,browserExport:true,download:true,jobId,contentDigest:job.result.contentDigest},null,2));console.log('Latest editor preview, two-chapter browser export and completed ZIP download passed.');
 }finally{await browser.close();}
}void main().catch(e=>{console.error(e.message);process.exitCode=1;});
