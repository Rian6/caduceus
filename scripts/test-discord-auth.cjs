const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto');
const {DiscordAuth}=require('../dist-electron/discord-auth');
const {DISCORD_REDIRECT_URI}=require('../dist-electron/discord-config');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'caduceus-oauth-')),file=path.join(directory,'login.enc');
// Test-only encryption adapter. Production uses Electron safeStorage/Windows DPAPI.
const encryption={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString(),'base64').toString()};
let authorization,mode='ok',revoked=false,refreshes=0,profileGate=null;
const request=async(url,options)=>{
 assert(String(url).startsWith('https://discord.com/api/v10/'));
 if(String(url).endsWith('/token/revoke')){revoked=true;return new Response('',{status:200})}
 if(String(url).endsWith('/token')){
  const form=options.body;assert(!form.has('client_secret'));
  if(form.get('grant_type')==='authorization_code'){
   assert.equal(form.get('code'),'fixture-code');
   assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),authorization.searchParams.get('code_challenge'));
   assert.equal(form.get('redirect_uri'),DISCORD_REDIRECT_URI);
  }else{assert.equal(form.get('grant_type'),'refresh_token');refreshes++}
  return new Response(JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}));
 }
 assert.equal(options.headers.Authorization,'Bearer fixture-access');
 if(profileGate)await profileGate;
 return new Response(JSON.stringify({id:'123456789012345678',username:'Tester'}));
};
const auth=new DiscordAuth(()=>'1554196376756293712',()=>file,encryption,async url=>{
 authorization=new URL(url);assert.equal(authorization.origin,'https://discord.com');assert.equal(authorization.searchParams.get('scope'),'identify');
 const callback=new URL(DISCORD_REDIRECT_URI);callback.search=new URLSearchParams({state:'wrong',code:'fixture-code'}).toString();
 assert.equal((await fetch(callback,{headers:{Connection:'close'}})).status,400,'invalid state must not complete login');
 callback.searchParams.set('state',authorization.searchParams.get('state'));
 if(mode==='deny'){callback.searchParams.delete('code');callback.searchParams.set('error','access_denied')}
 await fetch(callback,{headers:{Connection:'close'}});
},request);
(async()=>{try{
 assert.equal((await auth.login()).name,'Tester');
 assert(!fs.readFileSync(file,'utf8').includes('fixture-access'),'cache must use the encryption adapter');
 const saved=JSON.parse(encryption.decryptString(fs.readFileSync(file)));saved.expires=0;fs.writeFileSync(file,encryption.encryptString(JSON.stringify(saved)));
 const restored=new DiscordAuth(()=>'1554196376756293712',()=>file,encryption,async()=>{throw Error('must not reopen browser')},request);
 await restored.restore();assert.equal(restored.user().name,'Tester');assert.equal(refreshes,1);
 await restored.disconnect();assert(revoked);assert(!fs.existsSync(file));
 mode='deny';await assert.rejects(auth.login(),/cancelada/);
 mode='ok';let release;profileGate=new Promise(resolve=>release=resolve);
 const pending=auth.login();const rejected=assert.rejects(pending,/cancelada/);
 await new Promise(resolve=>setTimeout(resolve,100));auth.cancel();release();await rejected;
 assert(!fs.existsSync(file),'cancelled login must not persist a late token');
 console.log('PASS: OAuth PKCE, state rejection, callback, encrypted cache adapter, refresh, revocation, denial and cancellation.');
}finally{auth.cancel();fs.rmSync(directory,{recursive:true,force:true})}})().catch(error=>{console.error(error);process.exitCode=1});
