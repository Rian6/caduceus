import {spawn,ChildProcess} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import dgram from 'node:dgram';
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ConsoleHeartbeat} from './play-session';

export const XERA_PORT=18195;
export class UnlockTracker {
  private seen=new Set<string>();
  private initialized=false;
  consume(data:any){
    if(data?.delta||!Array.isArray(data?.unlocks))return [];
    const result:any[]=[];
    for(const u of [...data.unlocks].reverse()){
      if(!Number.isSafeInteger(u?.id)||u.id<=0)continue;
      const id=String(data.login?.user||'')+':'+u.id;
      if(this.initialized&&!this.seen.has(id)&&Number(u.ago)>=0&&Number(u.ago)<15)result.push({id:u.id,title:String(u.title||'Conquista').slice(0,200),points:Number(u.points)||0,game:String(data.game?.title||'').slice(0,200)});
      this.seen.add(id);
    }
    this.initialized=true;
    return result;
  }
}
export class SSEDecoder {
  private buffer='';
  push(chunk:string){
    this.buffer+=chunk;
    if(this.buffer.length>1024*1024)throw new Error('Evento muito grande.');
    const packets=this.buffer.split(/\r?\n\r?\n/);this.buffer=packets.pop()||'';
    return packets.flatMap(p=>{const body=p.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!body)return [];try{return [JSON.parse(body)]}catch{return []}});
  }
}
export class Xerabora {
  private child:ChildProcess|null=null;
  private request:http.ClientRequest|null=null;
  private retry:NodeJS.Timeout|null=null;
  private tracker=new UnlockTracker();
  private heartbeat=new ConsoleHeartbeat();
  private starting=false;
  private generation=0;
  private state={running:false,connected:false,user:'',game:'',error:''};
  constructor(private directory:()=>string,private emit:(channel:string,value:any)=>void,private profile?:()=>string){}
  async login(user:unknown,password:unknown){
    if(typeof user!=='string'||!user.trim()||user.length>100||typeof password!=='string'||!password||Buffer.byteLength(password)>250)throw new Error('Informe usuário e senha do RetroAchievements.');
    await this.start();
    await this.ready();
    await this.post('/login',{user:user.trim(),password});
  }
  async logout(){
    if(!this.child)await this.start();
    await this.ready();await this.post('/logout',{});this.stop();
  }
  private async ready(){
    for(let i=0;i<60;i++){
      if(!this.child)throw new Error('O componente de conquistas foi encerrado.');
      if(!this.state.error&&this.receivedState)return;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('O componente de conquistas não respondeu. Tente novamente.');
  }
  private receivedState=false;
  private async post(endpoint:'/login'|'/logout',fields:Record<string,string>){
    // The bundled HTTP parser requires this exact header casing and a known
    // body length. Do not use fetch's automatically generated lowercase header.
    const body=Buffer.from(new URLSearchParams(fields).toString(),'utf8');
    const response=await new Promise<{status:number;body:string}>((resolve,reject)=>{
      const req=http.request({hostname:'127.0.0.1',port:XERA_PORT,path:endpoint,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':body.length,'Connection':'close'},signal:AbortSignal.timeout(45000)},res=>{
        const chunks:Buffer[]=[];let size=0;
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>65536){req.destroy();reject(new Error('Resposta inválida do componente de conquistas.'))}else chunks.push(chunk)});
        res.on('end',()=>resolve({status:res.statusCode||0,body:Buffer.concat(chunks).toString('utf8')}));
        res.on('error',()=>reject(new Error('A conexão com o componente de conquistas foi interrompida.')));
      });
      req.on('error',()=>reject(new Error('Não foi possível conectar ao componente de conquistas. Tente novamente.')));
      req.end(body);
    });
    let data:any;try{data=JSON.parse(response.body)}catch{throw new Error('Resposta inválida do componente de conquistas.')}
    if(response.status!==200||!data?.ok){
      const errors:Record<string,string>={
        'enter both name and password':'O componente de conquistas não recebeu o usuário e a senha. Tente novamente.',
        'wrong name or password':'O RetroAchievements recusou o login. Confira seu usuário e sua senha.',
        'access denied':'O RetroAchievements negou acesso ao componente de conquistas. Isso não confirma senha incorreta. Verifique o acesso à sua conta no site.',
        'expired token':'A sessão do RetroAchievements expirou. Entre novamente.',
        'the RetroAchievements server could not be reached':'O componente de conquistas não conseguiu acessar o RetroAchievements. Confira sua conexão e tente novamente.',
        'not available in ui-only mode':'O componente de conquistas está ocupado ou indisponível. Aguarde e tente novamente.'
      };
      throw new Error(errors[String(data?.error)]||'O componente de conquistas não conseguiu concluir a operação. Tente novamente.');
    }
  }
  status(){return {...this.state}}
  private publish(){this.emit('xera:status',this.status())}
  async start(){
    if(this.starting||this.child)return this.status();
    this.starting=true;
    const generation=++this.generation;
    try {
      const exe=path.join(this.directory(),'xerabora-caduceus.exe');
      if(createHash('sha256').update(fs.readFileSync(exe)).digest('hex')!=='2ea6d93322966e619de4cfc11dcebc177b321eadd519bfb05d397a7b81d4730c')throw new Error('O componente xeRAbora não passou na verificação de integridade.');
      await new Promise<void>((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error('A porta local 18195 está ocupada. Feche outras instâncias do xeRAbora.')));s.listen(XERA_PORT,'127.0.0.1',()=>s.close(()=>resolve()))});
      await new Promise<void>((resolve,reject)=>{const s=dgram.createSocket('udp4');s.once('error',()=>{s.close();reject(new Error('A porta UDP 18194 está ocupada. Feche outras instâncias do xeRAbora.'))});s.bind(18194,()=>{s.close();resolve()})});
      if(generation!==this.generation)return this.status();
      this.tracker=new UnlockTracker();
      this.heartbeat=new ConsoleHeartbeat();
      const profile=this.profile?.();if(profile)fs.mkdirSync(profile,{recursive:true});
      const child=spawn(exe,['--ui-port',String(XERA_PORT),'--port','18194','--no-sound'],{cwd:this.directory(),windowsHide:true,stdio:'ignore',env:profile?{...process.env,LOCALAPPDATA:profile}:process.env});
      this.child=child;
      child.once('exit',()=>{if(this.child===child){this.stop();this.state.error='O xeRAbora foi encerrado.';this.publish()}});
      await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(new Error('Não foi possível iniciar o xeRAbora.')))});
      if(generation!==this.generation)return this.status();
      this.state={running:true,connected:false,user:'',game:'',error:''};this.publish();this.stream();return this.status();
    }catch(e){this.stop();throw e}finally{this.starting=false}
  }
  stop(){
    this.receivedState=false;
    this.generation++;
    const child=this.child;this.child=null;
    if(this.retry)clearTimeout(this.retry);this.retry=null;
    this.request?.destroy();this.request=null;
    if(child&&!child.killed)child.kill();
    this.state={running:false,connected:false,user:'',game:'',error:''};this.publish();return this.status();
  }
  private stream(){
    if(!this.child)return;
    const generation=this.generation;
    const decoder=new SSEDecoder();
    let ended=false;
    const retry=()=>{
      if(ended)return;ended=true;
      req.destroy();
      if(this.child&&generation===this.generation){this.state.connected=false;this.state.game='';this.state.error='Aguardando conexão com o xeRAbora…';this.publish();this.retry=setTimeout(()=>this.stream(),2000)}
    };
    const req=http.get(`http://127.0.0.1:${XERA_PORT}/events`,res=>{
      if(res.statusCode!==200){res.resume();retry();return}
      res.setEncoding('utf8');
      res.on('data',chunk=>{
        if(ended||generation!==this.generation)return;
        try {for(const data of decoder.push(String(chunk))){
          if(data?.delta||!data?.login||!data?.console)continue;
          this.receivedState=true;
          const connected=this.heartbeat.update(!!data.console.connected,data.console.packets);
          this.state={running:true,connected,user:data.login.ok?String(data.login.user||''):'',game:connected?String(data.game?.title||''):'',error:''};this.publish();
          for(const unlock of this.tracker.consume(data))if(connected)this.emit('xera:unlock',unlock);
        }}catch{retry()}
      });res.on('end',retry);res.on('error',retry);
    });
    this.request=req;req.setTimeout(15000,()=>{req.destroy();retry()});req.on('error',retry);
  }
}
