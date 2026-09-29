import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {DISCORD_REDIRECT_URI} from './discord-config';
type User={id:string;name:string};
type Session={clientId:string;access:string;refresh:string;expires:number;user:User};
type Encryption={isEncryptionAvailable:()=>boolean;encryptString:(value:string)=>Buffer;decryptString:(value:Buffer)=>string};
export class DiscordAuth{
  private session:Session|null=null;
  private generation=0;
  private cancelLogin:(()=>void)|null=null;
  constructor(private clientId:()=>string,private file:()=>string,private encryption:Encryption,private open:(url:string)=>Promise<void>,private request:typeof fetch=fetch){}
  configured(){return /^\d{17,20}$/.test(this.clientId())}
  user(){return this.session?.user||null}
  private save(session:Session){
    if(!this.encryption.isEncryptionAvailable())throw Error('Não foi possível proteger a conexão com Discord neste computador.');
    const file=this.file();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',this.encryption.encryptString(JSON.stringify(session)));fs.renameSync(file+'.tmp',file);this.session=session;
  }
  private async token(fields:Record<string,string>){
    let response:Response;
    try{response=await this.request('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.clientId(),...fields}),redirect:'error',signal:AbortSignal.timeout(15000)})}catch{throw Error('Não foi possível acessar o Discord. Tente novamente.')}
    if(!response.ok)throw Error('Discord recusou a autorização. Tente conectar novamente.');
    let data:any;try{data=await response.json()}catch{throw Error('Resposta inválida do Discord.')}
    if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Autorização inválida do Discord.');
    return data;
  }
  private async profile(access:string):Promise<User>{
    try{
      const response=await this.request('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${access}`},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error();const data=await response.json();
      if(!/^\d{17,20}$/.test(data.id)||typeof data.username!=='string')throw Error();
      return{id:data.id,name:String(data.global_name||data.username).slice(0,100)};
    }catch{throw Error('Não foi possível confirmar a conta do Discord. Conecte novamente.')}
  }
  async restore(){
    const version=++this.generation;if(!this.configured())return;
    try{
      const saved=JSON.parse(this.encryption.decryptString(fs.readFileSync(this.file())));
      if(saved.clientId!==this.clientId()||typeof saved.access!=='string'||typeof saved.refresh!=='string'||!Number.isFinite(saved.expires))return;
      let session=saved as Session;
      if(session.expires<Date.now()+60000){const data=await this.token({grant_type:'refresh_token',refresh_token:session.refresh});session={...session,access:data.access_token,refresh:data.refresh_token,expires:Date.now()+data.expires_in*1000}}
      const user=await this.profile(session.access);
      if(version===this.generation)this.save({...session,user});
    }catch{if(version===this.generation)this.session=null}
  }
  async login(){
    if(!this.configured())throw Error('A conexão com Discord ainda não foi configurada nesta versão do Caduceus.');
    if(this.cancelLogin)throw Error('Já existe uma autorização em andamento.');
    const version=++this.generation;
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    const code=await new Promise<string>((resolve,reject)=>{
      let settled=false;
      const server=http.createServer((req,res)=>{
        let url:URL;try{url=new URL(req.url||'/',DISCORD_REDIRECT_URI)}catch{res.writeHead(400);res.end();return}
        res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Referrer-Policy','no-referrer');
        if(req.method!=='GET'||url.pathname!=='/discord/callback'){res.writeHead(404);res.end();return}
        if(url.searchParams.get('state')!==state){res.writeHead(400);res.end('Autorização inválida.');return}
        if(url.searchParams.has('error')){res.once('finish',()=>finish(Error('Autorização cancelada no Discord.')));res.end('Autorização cancelada. Volte ao Caduceus.');return}
        const code=url.searchParams.get('code');if(!code||code.length>4096){res.writeHead(400);res.end();return}
        res.once('finish',()=>finish(undefined,code));res.end('Autorização recebida. Volte ao Caduceus.');
      });
      const finish=(error?:Error,code?:string)=>{if(settled)return;settled=true;clearTimeout(timer);server.close();server.closeAllConnections();this.cancelLogin=null;if(error)reject(error);else resolve(code!)};
      const timer=setTimeout(()=>finish(Error('O tempo para conectar ao Discord terminou. Tente novamente.')),120000);timer.unref();
      this.cancelLogin=()=>finish(Error('Conexão cancelada.'));
      server.once('error',()=>finish(Error('Não foi possível abrir o retorno de autorização do Discord. Feche outra instância do Caduceus.')));
      server.listen(53682,'127.0.0.1',()=>{
        const url=new URL('https://discord.com/oauth2/authorize');url.search=new URLSearchParams({client_id:this.clientId(),response_type:'code',redirect_uri:DISCORD_REDIRECT_URI,scope:'identify',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'consent'}).toString();
        void this.open(url.toString()).catch(()=>finish(Error('Não foi possível abrir o navegador.')));
      });
    });
    if(version!==this.generation)throw Error('Conexão cancelada.');
    const data=await this.token({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:DISCORD_REDIRECT_URI});
    const user=await this.profile(data.access_token);
    if(version!==this.generation)throw Error('Conexão cancelada.');
    this.save({clientId:this.clientId(),access:data.access_token,refresh:data.refresh_token,expires:Date.now()+data.expires_in*1000,user});return user;
  }
  async disconnect(){
    ++this.generation;this.cancelLogin?.();const previous=this.session;this.session=null;
    fs.rmSync(this.file(),{force:true});
    if(previous)try{await this.request('https://discord.com/api/v10/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.clientId(),token:previous.refresh,token_type_hint:'refresh_token'}),redirect:'error',signal:AbortSignal.timeout(5000)})}catch{}
  }
  cancel(){++this.generation;this.cancelLogin?.()}
}
