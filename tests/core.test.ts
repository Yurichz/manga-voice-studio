import {pagesDeleteSchema} from '@mvs/contracts';
import { describe,it,expect } from 'vitest';
import sharp from 'sharp';
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import { bboxSchema,pageEditSchema,pointerToBBox,speechInput as createSpeechInput,baseSpeechInput,speechModel,voxSettings,jobResultSchema,prepareSpeechText,isCurrentSpeechModel,textPreparationVersion } from '@mvs/contracts';
import { inputHash } from '../packages/contracts/src/server.js';
import { safeArchiveName,unpack,normalize } from '../packages/storage/src/import.js';
import { LocalStorageProvider } from '../packages/storage/src/index.js';
import { openapi } from '../apps/api/src/openapi.js';
// Cache tests use explicit prepared fixtures; number preparation is tested against Python/API.
function speechInput(owner:string,project:string,u:{spokenText:string;voiceVersionId:string|null},voice:{checksum:string},language:string,nonce?:string){return createSpeechInput(owner,project,u,voice,language,{synthesisText:prepareSpeechText(u.spokenText,language),textPreparationVersion,warnings:[]},nonce);}
async function zip(entries:{name:string;data:Buffer}[]){const a=archiver('zip');const chunks:Buffer[]=[];const done=new Promise<Buffer>((resolve,reject)=>{a.on('data',(b:Buffer)=>chunks.push(b));a.on('end',()=>resolve(Buffer.concat(chunks)));a.on('error',reject);});entries.forEach(e=>a.append(e.data,{name:e.name}));await a.finalize();return done;}
describe('geometry and versions',()=>{
 it('rejects out-of-bounds and non-positive rectangles',()=>{expect(()=>bboxSchema.parse({x:.9,y:0,width:.2,height:1})).toThrow();expect(()=>bboxSchema.parse({x:0,y:0,width:0,height:1})).toThrow();});
 it('maps mouse coordinates at different zoom/DPR without pixel assumptions',()=>{expect(pointerToBBox({x:150,y:250},{x:350,y:550},{left:50,top:50,width:1000,height:1000})).toEqual({x:.1,y:.2,width:.2,height:.3});expect(pointerToBBox({x:100,y:200},{x:200,y:350},{left:50,top:100,width:500,height:500})).toEqual({x:.1,y:.2,width:.2,height:.3});});
 it('rejects duplicate ids and dangling panels',()=>{const id=randomUUID();expect(()=>pageEditSchema.parse({expectedRevision:0,panels:[{id,bbox:{x:0,y:0,width:.5,height:.5},order:0},{id,bbox:{x:0,y:0,width:.5,height:.5},order:1}],utterances:[]})).toThrow();});
 it('scopes audio cache and only includes synthesis inputs',()=>{const u={spokenText:'Привет, мир!',voiceVersionId:'voice'},voice={checksum:'ref'};const a=speechInput('owner','project',u,voice,'Russian');expect(inputHash(a)).toBe(inputHash({...a}));expect(inputHash(a)).not.toBe(inputHash(speechInput('other','project',u,voice,'Russian')));expect(inputHash(a)).not.toBe(inputHash(speechInput('owner','project',{...u,spokenText:'Привет!'},voice,'Russian')));expect(inputHash(a)).not.toBe(inputHash(speechInput('owner','project',u,voice,'Russian','new-take')));});
});
it('separates VoxCPM cache from Qwen and validates variations against the current voice',()=>{
 const current=speechInput('owner','project',{spokenText:'Привет!',voiceVersionId:'voice'},{checksum:'ref'},'Russian');
 const variation=speechInput('owner','project',{spokenText:'Привет!',voiceVersionId:'voice'},{checksum:'ref'},'Russian','take');
 expect(current).toMatchObject({...speechModel,settings:{...voxSettings,seed:42}});
 expect(variation.settings.seed).not.toBe(current.settings.seed);
 expect(baseSpeechInput(variation)).toEqual(current);
 const {modelId:_id,adapterVersion:_adapter,...legacy}=current;
 const old={...legacy,modelRevision:'fd4b254389122332181a7c3db7f27e918eec64e3',settings:{}};
 expect(inputHash(old)).not.toBe(inputHash(current));expect(baseSpeechInput(old)).toEqual(old);
});
it('validates new synthesis metadata while retaining old and non-speech job results',()=>{
 expect(jobResultSchema.parse({modelRevision:'legacy',fileKey:'old.wav'}).fileKey).toBe('old.wav');
 expect(jobResultSchema.parse({pages:3})).toEqual({pages:3});
 expect(()=>jobResultSchema.parse({modelId:42})).toThrow();
 expect(()=>jobResultSchema.parse({sourceSampleRate:48000,sourceSampleCount:-1})).toThrow();
});
it('prepares uppercase Russian only, pins the actual text/mode and keeps old takes historical',()=>{
 const text='Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ. ЕЩЁ МИНУТУ!';
 expect(prepareSpeechText(text,'Russian')).toBe('Я тут думать пытаюсь, не мешай. Ещё минуту!');
 for(const [input,language] of [['Мика, это СССР.','Russian'],['HELLO WORLD','English'],['РУССКИЙ ТЕКСТ','English']])expect(prepareSpeechText(input,language)).toBe(input);
 const current=speechInput('owner','project',{spokenText:text,voiceVersionId:'voice'},{checksum:'ref'},'Russian');
 expect(current).toMatchObject({spokenText:text,synthesisText:prepareSpeechText(text,'Russian'),cloningMode:'reference-only',textPreparationVersion});
 expect(isCurrentSpeechModel({...current,textPreparationVersion:'ru-caps-v1'})).toBe(false);
 expect(inputHash({...current,textPreparationVersion:'ru-caps-v1'})).not.toBe(inputHash(current));
 const {synthesisText:_text,cloningMode:_mode,textPreparationVersion:_version,...old}=current;
 const oldTake={...old,adapterVersion:'voxcpm2-v1'};
 expect(inputHash(oldTake)).not.toBe(inputHash(current));expect(isCurrentSpeechModel(oldTake)).toBe(false);expect(isCurrentSpeechModel(current)).toBe(true);
 expect(baseSpeechInput({...oldTake,variationNonce:'old',settings:{...voxSettings,seed:12}})).toEqual(oldTake);
});
describe('safe import and storage',()=>{
 it('rejects traversal, Windows absolute paths and symlinks',()=>{for(const name of ['../x.png','a/../../x.png','C:/x.png','a\\x.png','/x.png'])expect(()=>safeArchiveName(name,0)).toThrow();expect(()=>safeArchiveName('x.png',0xa000<<16)).toThrow();});
 it('checks image format by content and strips metadata',async()=>{const data=await sharp({create:{width:32,height:20,channels:3,background:'white'}}).jpeg().toBuffer();const n=await normalize(data);expect(n.width).toBe(32);expect((await sharp(n.canonical).metadata()).format).toBe('png');await expect(normalize(Buffer.from('fake.png'))).rejects.toThrow();});
 it('sorts ZIP entries naturally and refuses nested archives',async()=>{const png=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();const files=await unpack(await zip(['10.png','2.png','1.png'].map(name=>({name,data:png}))));expect(files.map(f=>f.name)).toEqual(['1.png','2.png','10.png']);await expect(unpack(await zip([{name:'nested.zip',data:png}]))).rejects.toThrow();});
 it('refuses caller-selected absolute storage paths',()=>{const s=new LocalStorageProvider();expect(()=>s.resolve('../secret')).toThrow();expect(()=>s.resolve('C:/secret')).toThrow();expect(()=>s.resolve('project/../../secret')).toThrow();});
});
it('documents multipart uploads, file keys and batch job responses',()=>{
 const routes=[['/chapters/:chapterId/import','post'],['/projects/:projectId/voices/import','post'],['/chapters/:chapterId/speech','post'],['/files/:projectId/*key','get'],['/chapters/:chapterId/pages','delete']];
 const spec=openapi(routes.map(([path,method])=>({path,method,status:method==='post'?202:200,requestSchema:path==='/chapters/:chapterId/pages'?pagesDeleteSchema:undefined})));
 expect(spec.paths['/chapters/{chapterId}/import'].post.requestBody.content['multipart/form-data'].schema.properties.files.maxItems).toBe(50);
 expect(spec.paths['/projects/{projectId}/voices/import'].post.parameters.find((p:any)=>p.name==='X-Transcript').required).toBe(true);
 expect(spec.paths['/chapters/{chapterId}/speech'].post.responses['202'].content['application/json'].schema.required).toContain('jobIds');
 expect(spec.paths['/files/{projectId}/{key}'].get.parameters.find((p:any)=>p.name==='key').schema.format).toBeUndefined();
 expect(spec.paths['/chapters/{chapterId}/speech'].post.responses['409'].content['application/json'].schema.$ref).toBe('#/components/schemas/Error');
 const bulk=spec.paths['/chapters/{chapterId}/pages'].delete;
 expect(bulk.requestBody.content['application/json'].schema.properties.pages).toMatchObject({minItems:1,maxItems:50});
 expect(bulk.requestBody.content['application/json'].schema.properties.pages.items.required).toEqual(['id','expectedRevision']);
 expect(bulk.responses['200'].content['application/json'].schema.required).toContain('deletedCount');
});
