const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {RALoginCache}=require('../dist-electron/ra-login-cache.js');
const {RetroAchievements}=require('../dist-electron/retroachievements.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ra-login-')),file=path.join(root,'cache','retroachievements-login.enc');
const secret=crypto.randomBytes(32),iv=crypto.randomBytes(16);
const encryption={isEncryptionAvailable:()=>true,encryptString:s=>{const c=crypto.createCipheriv('aes-256-cbc',secret,iv);return Buffer.concat([c.update(s),c.final()])},decryptString:b=>{const d=crypto.createDecipheriv('aes-256-cbc',secret,iv);return Buffer.concat([d.update(b),d.final()]).toString()}};
(async()=>{
 try{
  const store=new RALoginCache(()=>file,encryption);
  const request=async()=>new Response(JSON.stringify({User:'Tester'}));
  const client=new RetroAchievements(request,store);
  await client.connect('Tester','private-test-key');
  assert(!fs.readFileSync(file).includes(Buffer.from('private-test-key')));
  const restarted=new RetroAchievements(request,new RALoginCache(()=>file,encryption));
  assert.deepEqual(restarted.status(),{user:'Tester'});
  assert(!JSON.stringify(restarted.status()).includes('private-test-key'));
  restarted.disconnect();assert(!fs.existsSync(file));
  assert.deepEqual(new RetroAchievements(request,store).status(),{user:null});
  fs.writeFileSync(file,'corrupt');assert.equal(store.load(),null);
  await client.connect('Tester','private-test-key');
  assert.equal(store.load().user,'Tester');
  const bad=new RetroAchievements(async()=>new Response('{}',{status:403}),store);
  await assert.rejects(()=>bad.connect('Other','bad-key'));assert.equal(store.load().key,'private-test-key');
  const unavailable=new RALoginCache(()=>file,{...encryption,isEncryptionAvailable:()=>false});
  assert.throws(()=>unavailable.save({user:'Other',key:'must-not-save'}));
  assert.equal(store.load().key,'private-test-key');
  assert(!fs.readdirSync(path.dirname(file)).some(n=>n.includes('.tmp-')));
  console.log('PASS: encrypted persistence, restart, disconnect, corrupt cache, failed login and unavailable encryption.');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
