import { create } from 'zustand';
import type { Utterance,BBox } from '@mvs/contracts';
export type Panel={id:string;bbox:BBox;order:number;source:'manual'|'ai'};
export type Content={panels:Panel[];utterances:Utterance[]};
type State={pageId:string|null;content:Content;selected:string|null;referenceBox:BBox|null;past:Content[];future:Content[];version:number;load:(id:string,c:Content)=>void;change:(c:Content)=>void;select:(id:string|null)=>void;chooseReference:(box:BBox)=>void;undo:()=>void;redo:()=>void};
export const useEditor=create<State>((set,get)=>({pageId:null,content:{panels:[],utterances:[]},selected:null,referenceBox:null,past:[],future:[],version:0,
 load:(id,c)=>set(s=>({pageId:id,content:c,selected:s.pageId===id&&[...c.panels,...c.utterances].some(x=>x.id===s.selected)?s.selected:null,referenceBox:null,past:[],future:[],version:0})),select:id=>set({selected:id,referenceBox:null}),chooseReference:referenceBox=>set({referenceBox}),
 change:c=>set(s=>({content:c,past:[...s.past,s.content].slice(-100),future:[],version:s.version+1})),
 undo:()=>{const s=get(),c=s.past.at(-1);if(c)set({content:c,past:s.past.slice(0,-1),future:[s.content,...s.future],version:s.version+1});},
 redo:()=>{const s=get(),c=s.future[0];if(c)set({content:c,past:[...s.past,s.content],future:s.future.slice(1),version:s.version+1});}
}));
