const {Xerabora}=require('../dist-electron/xerabora');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'caduceus-engine-'));
let received=false;
const x=new Xerabora(()=>path.resolve('vendor/xerabora'),(_channel,value)=>{if(value.running&&!value.error)received=true},()=>profile);
(async()=>{
 try{
  await x.start();
  // The protected local API should reject an empty login without contacting RA.
  let ready=false;
  for(let i=0;i<40;i++){
   try {const response=await fetch('http://127.0.0.1:18195/login',{method:'POST',body:'user=&password=',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(1000)});const data=await response.json();assert.equal(data.ok,false);ready=true;break}catch{await new Promise(r=>setTimeout(r,250))}
  }
  assert(ready,'native component must expose its loopback API');assert(received);
  assert.equal(x.status().user,'');
  console.log('PASS: bundled native adapter starts with isolated profile, serves local API and rejects empty login.');
 } finally {x.stop();await new Promise(r=>setTimeout(r,700));fs.rmSync(profile,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
