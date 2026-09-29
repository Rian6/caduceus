const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {hashPS2}=require('../dist-electron/ra-iso');
const {RACompatibility}=require('../dist-electron/ra-compatibility');
const {RetroAchievements}=require('../dist-electron/retroachievements');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'caduceus-ra-'));
function fixture(file,exe=Buffer.from('\x7fELF-fixture'),nested=false){
 const data=Buffer.alloc(32*2048),name=nested?'BIN\\SLUS_209.46':'SLUS_209.46';
 function record(at,name,sector,size,dir=false){const n=Buffer.from(name);const len=33+n.length+(n.length%2===0?1:0);data[at]=len;data.writeUInt32LE(sector,at+2);data.writeUInt32LE(size,at+10);data[at+25]=dir?2:0;data[at+32]=n.length;n.copy(data,at+33);return len}
 data[16*2048]=1;data.write('CD001',16*2048+1);data.writeUInt16LE(2048,16*2048+128);record(16*2048+156,'\0',20,2048,true);
 const cnf=Buffer.from(`BOOT2 = cdrom0:\\${name};1\r\nVER = 1.03\r\n`);
 let at=20*2048;at+=record(at,'SYSTEM.CNF;1',21,cnf.length);
 if(nested){record(at,'BIN',23,2048,true);record(23*2048,'SLUS_209.46;1',22,exe.length)}else record(at,'SLUS_209.46;1',22,exe.length);
 cnf.copy(data,21*2048);exe.copy(data,22*2048);fs.writeFileSync(file,data);
 return createHash('md5').update(name).update(exe).digest('hex');
}
(async()=>{try{
 const file=path.join(root,'test.iso'),expected=fixture(file);
 const api=new RetroAchievements(async url=>{
   assert.equal(url.pathname,'/API/API_GetGameList.php');
   assert.equal(url.searchParams.get('i'),'21');assert.equal(url.searchParams.get('h'),'1');assert.equal(url.searchParams.get('f'),'1');
   return new Response(JSON.stringify([{ID:2772,Title:'Fixture',NumAchievements:10,Hashes:[expected],ImageIcon:'/Images/123.png'}]));
 },{load:()=>({user:'Test',key:'fixture-key'}),save:()=>{},clear:()=>{}});
 assert.equal((await api.compatibilityIndex())[0].hashes[0],expected);
 assert.equal(await hashPS2(file),expected);
 const nested=path.join(root,'nested.iso');const nestedHash=fixture(nested,Buffer.from('\x7fELF-nested'),true);assert.equal(await hashPS2(nested),nestedHash);
 const bad=path.join(root,'bad.iso');fs.writeFileSync(bad,Buffer.alloc(10));await assert.rejects(hashPS2(bad));
 let requests=0;
 const cache=path.join(root,'cache.json');
 const service=new RACompatibility(()=>cache,async()=>{requests++;return[{id:2772,title:'Fixture',count:10,image:null,hashes:[expected]}]});
 assert.equal((await service.check()).status,'unknown');
 assert.equal((await service.check(file)).status,'compatible');
 assert.equal((await service.check(nested)).status,'unmatched');
 assert.equal((await service.check(bad)).status,'error');
 assert.equal((await service.check(path.join(root,'game.bin'))).status,'unsupported');
 await service.sync(true);assert.equal(requests,1,'daily cache must prevent repeated API calls');
 fixture(file,Buffer.from('\x7fELF-replaced'));const future=new Date(Date.now()+10000);fs.utimesSync(file,future,future);
 assert.equal((await service.check(file)).status,'unmatched','replaced ISO must lose compatible badge');
 const offline=new RACompatibility(()=>cache,async()=>{throw Error('offline')});assert.equal((await offline.check(nested)).status,'unmatched');
 const noCache=new RACompatibility(()=>path.join(root,'missing.json'),async()=>{throw Error('offline')});assert.equal((await noCache.check(file)).status,'unknown','network error is not incompatibility');
 console.log('PASS: PS2 hash, nested boot path, truncated ISO, active match, replacement invalidation, daily/offline cache and unknown states.');
}finally{fs.rmSync(root,{recursive:true,force:true})}})().catch(error=>{console.error(error);process.exitCode=1});
