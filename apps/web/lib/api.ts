export class ApiError extends Error{constructor(readonly status:number,message:string){super(message);}}
export async function api(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){
 const pending=method==='POST'&&/\/(import|replace|design|analysis|references|candidates|render|speech|retry)$/.test(path)?crypto.randomUUID():null;
 if(pending)window.dispatchEvent(new CustomEvent('mvs-request',{detail:{id:pending,path,active:true,startedAt:Date.now()}}));
 try{
 const response=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...headers,...(method==='POST'?{'Idempotency-Key':crypto.randomUUID()}: {})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new ApiError(response.status,data.error?.message||'Ошибка запроса');return data;
 }finally{if(pending)window.dispatchEvent(new CustomEvent('mvs-request',{detail:{id:pending,active:false}}));}
}
export function fileUrl(key:string){return '/api/v1/files/'+key.split('/').map(encodeURIComponent).join('/');}
