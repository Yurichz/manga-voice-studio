import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {PrismaClient} from '@prisma/client';
import {betterAuth} from 'better-auth';
import {prismaAdapter} from 'better-auth/adapters/prisma';
import {db} from '@mvs/database';
import {storage} from '../packages/storage/src/index.js';
import {makeAuth} from '../apps/api/src/auth.js';

const root=process.cwd(),run=promisify(execFile),token=randomUUID().replaceAll('-','').slice(0,12);
const restoreDatabase='mvs_restore_'+token,invalidDatabase='mvs_invalid_'+token;
const backup=path.join(root,'outputs','backup-'+token),restoreStorage=path.join(root,'work','restore-'+token,'private');
const restoredUrl=new URL(process.env.DATABASE_URL!);restoredUrl.pathname='/'+restoreDatabase;
const restored=new PrismaClient({datasources:{db:{url:restoredUrl.toString()}}});
let userId='',projectId='',writersStopped=false;const createdDatabases:string[]=[];
const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
async function ps(file:string,args:string[]=[]){return run('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',file,...args],{cwd:root,timeout:120000});}
async function docker(args:string[]){return run('docker',['compose','exec','-T','postgres',...args],{cwd:root,timeout:60000});}
async function main(){
 const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');
 const account=await makeAuth(true).api.signUpEmail({body:{email,password,name:'Backup verification'}});userId=account.user.id;
 const p=await db.project.create({data:{textLanguage:'ru',speechLanguage:'Russian',ownerId:userId,title:'Backup verification '+token}});projectId=p.id;
 const chapter=await db.chapter.create({data:{projectId,title:'Сохранённая глава',order:0}});
 const image=await fs.readFile('work/fixtures/chapter-1.png'),wav=await fs.readFile('outputs/gpu-smoke/reference.wav');
 const imageKey=projectId+'/pages/backup.png',referenceKey=projectId+'/voices/backup.wav';await storage.write(imageKey,image);await storage.write(referenceKey,wav);
 const page=await db.page.create({data:{chapterId:chapter.id,projectId,order:0,name:'Пример.png',width:800,height:1000,checksum:sha(image),transform:{},imageKey,previewKey:imageKey,sourceKey:imageKey}});
 const profile=await db.voiceProfile.create({data:{projectId,name:'Синтетический голос'}});
 const voice=await db.voiceProfileVersion.create({data:{projectId,profileId:profile.id,referenceKey,checksum:sha(wav),transcript:'Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.',language:'Russian',modelRevision:'5ecdb67327fd37bb2e042aab12ff7391903235d3',settings:{}}});
 const utterance=await db.utterance.create({data:{id:randomUUID(),projectId,pageId:page.id,bbox:{x:.1,y:.1,width:.2,height:.2},order:0,originalText:'Резервная копия: Ё, й, 🤖',spokenText:'Резервная копия: Ё, й, 🤖',voiceVersionId:voice.id,included:false}});
 await ps('scripts/stop.ps1');writersStopped=true;await ps('scripts/backup.ps1',['-Destination',backup]);
 for(const name of [restoreDatabase,invalidDatabase]){await docker(['createdb','-U',process.env.POSTGRES_USER!,name]);createdDatabases.push(name);}
 await ps('scripts/restore.ps1',['-Source',backup,'-Database',restoreDatabase,'-StorageDirectory',restoreStorage]);
 assert.equal((await restored.utterance.findUniqueOrThrow({where:{id:utterance.id}})).spokenText,utterance.spokenText);
 assert.equal((await restored.voiceProfileVersion.findUniqueOrThrow({where:{id:voice.id}})).checksum,sha(wav));
 assert.equal(sha(await fs.readFile(path.join(restoreStorage,referenceKey))),sha(wav));
 assert.equal(sha(await fs.readFile(path.join(restoreStorage,imageKey))),sha(image));
 const auth=betterAuth({database:prismaAdapter(restored,{provider:'postgresql'}),secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BETTER_AUTH_URL,emailAndPassword:{enabled:true,disableSignUp:true}});
 assert.equal((await auth.api.signInEmail({body:{email,password}})).user.id,userId);
 let refused=false;try{await ps('scripts/restore.ps1',['-Source',backup,'-Database',restoreDatabase,'-StorageDirectory',path.join(root,'work','refused-'+token)]);}catch(e:any){refused=e.stderr.includes('empty database');}assert(refused,'Nonempty database must be rejected before restoration');
 const corrupted=path.join(root,'work','corrupted-'+token);await fs.cp(backup,corrupted,{recursive:true});await fs.appendFile(path.join(corrupted,'private',referenceKey),'corrupted');
 refused=false;try{await ps('scripts/restore.ps1',['-Source',corrupted,'-Database',invalidDatabase,'-StorageDirectory',path.join(root,'work','invalid-'+token)]);}catch(e:any){refused=e.stderr.includes('corrupted private file');}assert(refused,'Corrupted private files must be rejected');
 await fs.writeFile(path.join(backup,'verification.json'),JSON.stringify({passed:true,databaseRestore:true,unicode:true,realVoiceReferenceChecksum:true,restoredLogin:true,rejectNonemptyDatabase:true,rejectCorruptedFiles:true},null,2));
 console.log('Backup/restore passed. Verified backup:',backup);
}
async function cleanup(){
 await restored.$disconnect();for(const name of createdDatabases)await docker(['dropdb','-U',process.env.POSTGRES_USER!,name]);
 if(projectId){await db.utterance.deleteMany({where:{projectId}});await db.chapter.deleteMany({where:{projectId}});await db.project.deleteMany({where:{id:projectId}});await storage.removeProject(projectId);}if(userId)await db.user.deleteMany({where:{id:userId}});await db.$disconnect();
 for(const dir of [path.dirname(restoreStorage),path.join(root,'work','corrupted-'+token)]){assert(path.resolve(dir).startsWith(path.join(root,'work')+path.sep));await fs.rm(dir,{recursive:true,force:true});}
 if(writersStopped)await new Promise<void>((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-File','scripts/start.ps1'],{cwd:root,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Application restart failed: '+code)));});
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(cleanup);
