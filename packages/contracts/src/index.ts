import { z } from 'zod';


export const bboxSchema = z.object({ x:z.number().min(0).max(1), y:z.number().min(0).max(1), width:z.number().positive().max(1), height:z.number().positive().max(1) }).refine(b=>b.x+b.width<=1.000001 && b.y+b.height<=1.000001,'The region extends beyond the page');
export type BBox = z.infer<typeof bboxSchema>;
export const panelSchema = z.object({id:z.uuid(),bbox:bboxSchema,order:z.number().int().nonnegative(),source:z.enum(['manual','ai']).default('manual')});
export const utteranceSchema = z.object({id:z.uuid(),panelId:z.uuid().nullable().default(null),bbox:bboxSchema,order:z.number().int().nonnegative(),kind:z.enum(['dialogue','thought','narration','sfx']),originalText:z.string().max(10000),spokenText:z.string().max(10000),characterId:z.uuid().nullable(),voiceVersionId:z.uuid().nullable(),pauseMs:z.number().int().min(0).max(10000),included:z.boolean(),reviewStatus:z.enum(['unreviewed','reviewed']),revision:z.number().int().nonnegative().default(0)});
export type Utterance = z.infer<typeof utteranceSchema>;
export const pagesDeleteSchema=z.object({pages:z.array(z.object({id:z.uuid(),expectedRevision:z.number().int().nonnegative()})).min(1).max(50).refine(pages=>new Set(pages.map(p=>p.id)).size===pages.length,'Duplicate pages'),confirm:z.literal(true)});
export const pageEditSchema = z.object({expectedRevision:z.number().int().nonnegative(),panels:z.array(panelSchema).max(200),utterances:z.array(utteranceSchema).max(500)}).superRefine((v,c)=>{
 const ids=[...v.panels,...v.utterances].map(x=>x.id); if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Duplicate identifiers'});
 if(v.utterances.some(u=>u.panelId&&!v.panels.some(p=>p.id===u.panelId)))c.addIssue({code:'custom',message:'The panel does not belong to this page'});
});
export const projectFieldsSchema=z.object({title:z.string().trim().min(1).max(200),textLanguage:z.string().min(2).max(30),speechLanguage:z.string().min(2).max(30),readingDirection:z.enum(['rtl','ltr'])});
export const projectSchema=projectFieldsSchema.extend({textLanguage:projectFieldsSchema.shape.textLanguage.default('en'),speechLanguage:projectFieldsSchema.shape.speechLanguage.default('English'),readingDirection:projectFieldsSchema.shape.readingDirection.default('rtl')});
export const analysisSchema=z.object({panels:z.array(z.object({bbox:bboxSchema,order:z.number().int().nonnegative()})).max(200),utterances:z.array(z.object({bbox:bboxSchema,order:z.number().int().nonnegative(),kind:z.enum(['dialogue','thought','narration','sfx']),text:z.string().max(10000),needsReview:z.boolean()})).max(500),characters:z.array(z.object({bbox:bboxSchema,description:z.string().max(1000)})).max(100)});
export const speechRevision='32279effe8c19989596f05d353d1447f51d9e915';
export const speechModel={modelId:'openbmb/VoxCPM2',modelRevision:speechRevision,adapterVersion:'voxcpm2-v2'} as const;
export const textPreparationVersion='ru-numbers-v1';
export const preparedSpeechSchema=z.object({synthesisText:z.string().max(10000),textPreparationVersion:z.literal(textPreparationVersion),warnings:z.array(z.string())});
export type PreparedSpeech=z.infer<typeof preparedSpeechSchema>;
export const pronunciationPreviewSchema=preparedSpeechSchema.extend({utteranceId:z.uuid(),utteranceRevision:z.number().int().nonnegative(),spokenText:z.string().max(10000)});
export const voxSettings={cfg_value:2.0,inference_timesteps:10,min_len:2,max_len:4096,normalize:false,denoise:false,retry_badcase:true,retry_badcase_max_times:2,retry_badcase_ratio_threshold:6.0} as const;
function variationSeed(nonce?:string){let seed=42;if(nonce)for(const c of nonce)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;return seed%2147483648;}
export function prepareSpeechText(text:string,language:string){
 if(!['russian','ru'].includes(language.toLowerCase())||!/[А-ЯЁ]/u.test(text)||/[а-яё]/u.test(text))return text;
 return text.replace(/[А-ЯЁ]/gu,c=>c.toLowerCase()).replace(/(^|[.!?…][\s«"'(]*)([а-яё])/gu,(_match,start,letter)=>start+letter.toUpperCase());
}
export function speechInput(ownerId:string,projectId:string,u:{spokenText:string;voiceVersionId:string|null},voice:{checksum:string},language:string,prepared:PreparedSpeech,nonce?:string){return {ownerId,projectId,spokenText:u.spokenText,synthesisText:prepared.synthesisText,textPreparationVersion:prepared.textPreparationVersion,cloningMode:'reference-only',voiceVersionId:u.voiceVersionId,referenceChecksum:voice.checksum,language,...speechModel,settings:{...voxSettings,seed:variationSeed(nonce)},normalizationVersion:'pcm24k-v1',splitVersion:'sentence-v1',...(nonce?{variationNonce:nonce}:{})};}
// A variation changes its seed as well as its nonce. Compare current takes using base settings.
export function baseSpeechInput(canonical:Record<string,any>){const {variationNonce:_nonce,...base}=canonical;return ['voxcpm2-v1',speechModel.adapterVersion].includes(canonical.adapterVersion)?{...base,settings:{...canonical.settings,seed:42}}:base;}
export function isCurrentSpeechModel(canonical:Record<string,any>){return canonical.modelId===speechModel.modelId&&canonical.modelRevision===speechModel.modelRevision&&canonical.adapterVersion===speechModel.adapterVersion&&canonical.textPreparationVersion===textPreparationVersion;}
export const synthesisMetadataSchema=z.object({modelId:z.string().optional(),modelRevision:z.string().optional(),adapterVersion:z.string().optional(),generationSettings:z.record(z.string(),z.unknown()).optional(),cloningMode:z.enum(['reference-only','continuation']).optional(),synthesisText:z.string().max(10000).optional(),textPreparationVersion:z.string().optional()});
export const jobResultSchema=synthesisMetadataSchema.extend({sourceSampleRate:z.number().int().positive().optional(),sourceSampleCount:z.number().int().positive().optional()}).catchall(z.unknown());
export function pointerToBBox(start:{x:number;y:number},end:{x:number;y:number},rect:{left:number;top:number;width:number;height:number}):BBox {
 const x=Math.max(0,Math.min(1,(Math.min(start.x,end.x)-rect.left)/rect.width)); const y=Math.max(0,Math.min(1,(Math.min(start.y,end.y)-rect.top)/rect.height));
 return bboxSchema.parse({x,y,width:Math.min(1-x,Math.abs(end.x-start.x)/rect.width),height:Math.min(1-y,Math.abs(end.y-start.y)/rect.height)});
}



export const phaseLabels:Record<string,string>={queued:'Queued',preparing:'Validating inputs',unpacking:'Validating and unpacking',normalizing:'Preparing pages',loading_prompt:'Loading the instruction model',preparing_prompt:'Preparing voice instructions',loading_model:'Loading the model',preparing_voice:'Preparing the saved voice',generating:'Generating audio',analyzing:'Page analysis',encoding:'Encoding the image',web_encoding:'Encoding MP3 and pages',searching:'Searching references',assembling:'Assembling WAV',writing_audio:'Writing WAV',packaging:'Packaging ZIP',publishing:'Publishing the result',complete:'Complete',failed:'Error',blocked:'Unavailable',cancel_requested:'Cancelling',cancelled:'Cancelled'};
export const jobLabels:Record<string,string>={import:'Page import',replace_page:'Page replacement',speech:'Speech generation',voice_design:'Voice design',voice_import:'Voice import',analysis:'Page analysis',embedding:'Character reference',candidates:'Character search',render:'Chapter render',publication_export:'Publication export'};
export const activeStatuses=['queued','running','blocked','cancel_requested'];
export const terminalStatuses=['succeeded','failed','cancelled'];
export const progressSchema=z.object({phase:z.enum(Object.keys(phaseLabels) as [string,...string[]]),completedPhases:z.array(z.enum(Object.keys(phaseLabels) as [string,...string[]])).max(30).optional(),completed:z.number().int().nonnegative().optional(),total:z.number().int().positive().optional(),unit:z.enum(['pages','chunks','segments','files']).optional(),updatedAt:z.iso.datetime()}).refine(p=>p.completed===undefined?p.total===undefined:p.total!==undefined&&p.completed<=p.total,'Invalid progress counter');
export type JobProgress=z.infer<typeof progressSchema>;
export const progressJobSchema=z.object({id:z.uuid(),batchId:z.uuid().nullable(),kind:z.string(),status:z.string(),stage:z.string(),progress:progressSchema.nullable(),error:z.string().nullable(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime(),attempts:z.number().int(),result:jobResultSchema.nullable(),description:z.string().optional(),transcript:z.string().optional(),name:z.string().optional(),synthesis:synthesisMetadataSchema.optional()});
export const batchSummarySchema=z.object({id:z.uuid(),total:z.number().int().nonnegative(),succeeded:z.number().int().nonnegative(),failed:z.number().int().nonnegative(),cancelled:z.number().int().nonnegative(),active:z.number().int().nonnegative(),remaining:z.number().int().nonnegative()});
export const jobProgressResponseSchema=z.object({jobs:z.array(progressJobSchema),batches:z.array(batchSummarySchema)});
export type ProgressJob=z.infer<typeof progressJobSchema>;
export function jobPhases(kind:string){return ['queued','preparing',...({import:['unpacking','normalizing'],replace_page:['normalizing'],speech:['loading_model','preparing_voice','generating','writing_audio'],voice_design:['loading_prompt','preparing_prompt','loading_model','generating','writing_audio'],voice_import:['writing_audio'],analysis:['loading_model','analyzing'],embedding:['loading_model','encoding'],candidates:['loading_model','encoding','searching'],render:['assembling','writing_audio','packaging'],publication_export:['web_encoding','packaging']}[kind]||[]),'publishing','complete'];}
export function summarizeBatch(id:string,jobs:{status:string;input:unknown;createdAt:Date}[]){
 const latest=new Map<string,(typeof jobs)[number]>();
 for(const j of [...jobs].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())){const key=(j.input as {utteranceId?:string}).utteranceId;if(key&&!latest.has(key))latest.set(key,j);}
 const counts={id,total:latest.size,succeeded:0,failed:0,cancelled:0,active:0,remaining:Math.max(0,...jobs.map(j=>Number((j.input as {batchRemaining?:number}).batchRemaining)||0))};
 for(const j of latest.values()){if(j.status==='succeeded')counts.succeeded++;else if(j.status==='failed')counts.failed++;else if(j.status==='cancelled')counts.cancelled++;else counts.active++;}return counts;
}
