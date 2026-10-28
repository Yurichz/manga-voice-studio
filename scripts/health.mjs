const demo=process.argv.includes('--demo'),verbose=process.argv.includes('--verbose');
const checks=[['api','http://127.0.0.1:3001/health/live'],['web','http://127.0.0.1:3000/']];
if(!demo)checks.push(['ai','http://127.0.0.1:8001/health']);
const results=await Promise.all(checks.map(async([name,url])=>{
 try{
  const response=await fetch(url,{headers:name==='ai'?{'X-AI-Secret':process.env.AI_SECRET||''}:{},signal:AbortSignal.timeout(3000),redirect:'error'});
  await response.arrayBuffer();if(!response.ok)throw new Error('HTTP '+response.status);
  return {name,ready:true};
 }catch(error){return {name,ready:false,error:error.message};}
}));
if(verbose)for(const r of results)console.log(r.name+': '+(r.ready?'ready':'unavailable ('+r.error+')'));
process.exitCode=results.every(r=>r.ready)?0:1;
