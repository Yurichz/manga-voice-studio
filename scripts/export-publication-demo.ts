// Explicit fixture adapter: the supplied English page and actual generated demo speech.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const loadLocal=createRequire(__filename);
async function main(){
 process.env.STORAGE_ROOT=path.resolve('work/publication-demo/private');const {storage}=loadLocal('../packages/storage/src/index.ts');const {exportPublication,namespace}=loadLocal('../packages/publication/src/export.ts');
 const demoRoot=path.resolve(process.env.DEMO_ROOT||'storage/demo-english');const demo=JSON.parse(await fs.readFile(path.join(demoRoot,'demo.json'),'utf8')),p=demo.project,c=demo.chapter;
 for(const key of [c.renders[0].fileKey,...c.pages.map((p:any)=>p.imageKey)]){const source=path.join(demoRoot,key.split('/').pop()!);await storage.write(key,await fs.readFile(source));}
 const snapshot={sourceNamespace:await namespace(p.id),project:{id:p.id,revision:p.revision,title:p.title,textLanguage:p.textLanguage,speechLanguage:p.speechLanguage,readingDirection:p.readingDirection},metadata:{description:'Supplied English demonstration page with real locally generated synthetic speech. Manual annotations; not an OCR accuracy benchmark.',credits:[],coverPageId:c.pages[0].id},chapters:[{id:c.id,title:c.title,order:c.order,revision:c.revision,readingDirection:p.readingDirection,render:{fileKey:c.renders[0].fileKey,manifest:c.renders[0].manifest},pages:c.pages.map((page:any)=>({id:page.id,order:page.order,width:page.width,height:page.height,imageKey:page.imageKey,checksum:createHash('sha256').update(readFileSync(storage.resolve(page.imageKey))).digest('hex'),panels:page.panels.map((panel:any)=>({id:panel.id,order:panel.order,bbox:panel.bbox})),utterances:page.utterances.map((u:any)=>({id:u.id,order:u.order,panelId:u.panelId,bbox:u.bbox,speakerId:null,speaker:null,originalText:u.originalText,spokenText:u.spokenText,kind:u.kind,included:u.included}))}))}]};
 const output=path.resolve(process.argv[2]||'outputs/publication-demo.mvs-publication.zip');console.log(await exportPublication(snapshot,output),output);
}void main();
