import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function rpcFrame(op:number,value:unknown){
  const body=Buffer.from(JSON.stringify(value));const header=Buffer.alloc(8);
  header.writeUInt32LE(op,0);header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);
}
export class RPCDecoder{
  private buffer:Buffer=Buffer.alloc(0);
  push(chunk:Buffer){
    this.buffer=Buffer.concat([this.buffer,chunk]);const frames:{op:number;data:any}[]=[];
    while(this.buffer.length>=8){const size=this.buffer.readUInt32LE(4);if(size>1024*1024)throw Error('Invalid RPC frame');if(this.buffer.length<size+8)break;
      frames.push({op:this.buffer.readUInt32LE(0),data:JSON.parse(this.buffer.subarray(8,size+8).toString())});this.buffer=this.buffer.subarray(size+8);
    }return frames;
  }
}
type Config={enabled:boolean;clientId:string};
export class DiscordPresence{
  private config:Config={enabled:false,clientId:''};
  private socket:net.Socket|null=null;
  private timer:NodeJS.Timeout|null=null;
  private ready=false;
  private nextConnect=0;
  private lastSent='';
  private sentAt=0;
  private pending:{nonce:string;at:number;hasActivity:boolean;game:string}|null=null;
  private message='Desativado';
  private accountId:string|null=null;
  requireAccount=false;
  private smb='';private telemetry='';private game='';private started=0;
  private smbCover='';private telemetryCover='';
  private trophy:{title:string;points:number}|null=null;
  constructor(private file:()=>string,private emit:(value:any)=>void,private connect:(pipe:string)=>net.Socket=pipe=>net.createConnection(pipe),private now:()=>number=Date.now){}
  start(){
    try{const data=JSON.parse(fs.readFileSync(this.file(),'utf8'));if(typeof data.enabled==='boolean'&&typeof data.clientId==='string'&&/^\d{17,20}$/.test(data.clientId))this.config=data}catch{}
    if(!this.timer)this.timer=setInterval(()=>this.tick(),1000);this.timer.unref();this.tick();
  }
  status(){return{...this.config,connected:this.ready,message:this.message,game:this.game,achievement:this.trophy?.title||''}}
  setAccount(id:string|null){this.close();this.accountId=id;this.nextConnect=0;this.tick()}
  configure(input:unknown){
    const value=input as Config;
    if(!value||typeof value.enabled!=='boolean'||typeof value.clientId!=='string'||(value.clientId!==''&&!/^\d{17,20}$/.test(value.clientId))||(value.enabled&&!value.clientId))throw Error('Informe um Application ID válido do Discord.');
    const config={enabled:value.enabled,clientId:value.clientId};
    const file=this.file();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(config));fs.renameSync(file+'.tmp',file);
    this.close();this.config=config;this.nextConnect=0;this.message=config.enabled?'Conectando ao Discord…':'Desativado';this.tick();return this.status();
  }
  updateSMB(title:string|null,cover?:string|null){this.smb=title||'';this.smbCover=this.coverURL(cover);this.updateGame()}
  updateConsole(status:{connected:boolean;game:string;icon?:string|null}){this.telemetry=status.connected?status.game:'';this.telemetryCover=status.connected?this.coverURL(status.icon):'';this.updateGame()}
  private coverURL(value?:string|null){try{const url=new URL(value||'');return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''}catch{return ''}}
  private updateGame(){const next=this.telemetry||this.smb;if(next!==this.game){this.game=next;this.started=Math.floor(this.now()/1000);this.trophy=null}this.tick()}
  unlock(value:{game:string;title:string;points:number}){
    // Never turn a historical/API-only achievement into a console session.
    if(!this.telemetry||value.game!==this.telemetry)return;
    this.trophy={title:String(value.title).slice(0,90),points:Number(value.points)||0};this.tick();
  }
  activity(){
    if(!this.game)return null;
    const trophy=this.trophy;
    const cover=this.telemetry?(this.telemetryCover||(this.telemetry===this.smb?this.smbCover:'')):this.smbCover;
    return{type:0,name:this.game.slice(0,128),status_display_type:0,details:trophy?`🏆 ${trophy.title} · ${trophy.points} pts`.slice(0,128):'Nenhuma conquista nesta sessão',state:'Caduceus · PlayStation 2',...(cover?{assets:{large_image:cover,large_text:this.game.slice(0,128)}}:{}),timestamps:{start:this.started},instance:false};
  }
  private publish(){this.emit(this.status())}
  private close(){
    const socket=this.socket;this.socket=null;
    if(socket){if(this.ready)socket.end(rpcFrame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:null},nonce:randomUUID()}));else socket.destroy();const timer=setTimeout(()=>socket.destroy(),500);timer.unref()}
    this.ready=false;this.pending=null;this.lastSent='';this.sentAt=0;
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.config.enabled=false;this.close();this.message='Desativado';this.publish()}
  private tick(){
    if(this.requireAccount&&!this.accountId){this.message='Conecte sua conta Discord';return}
    if(!this.config.enabled){this.message='Desativado';return}
    if(!this.socket){if(this.now()>=this.nextConnect){this.nextConnect=this.now()+15000;this.open(0)}return}
    if(!this.ready)return;
    if(this.pending){if(this.now()-this.pending.at>10000)this.fail('Discord não respondeu. Tentando reconectar…');return}
    const activity=this.activity(),serialized=JSON.stringify(activity);
    if(serialized===this.lastSent)return;
    // Coalesce rapid events. Clear presence immediately on disconnect.
    if(activity&&this.lastSent!=='null'&&this.sentAt&&this.now()-this.sentAt<15000)return;
    const nonce=randomUUID();this.pending={nonce,at:this.now(),hasActivity:!!activity,game:this.game};this.lastSent=serialized;this.sentAt=this.now();
    this.message=activity?'Enviando atividade ao Discord…':'Removendo atividade do Discord…';this.publish();
    this.socket.write(rpcFrame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity},nonce}));
  }
  private fail(message:string){this.close();this.nextConnect=this.now()+15000;this.message=message;this.publish()}
  private open(index:number){
    if(!this.config.enabled)return;
    if(index>=10){this.message='Abra o Discord no computador.';this.publish();return}
    const socket=this.connect(`\\\\?\\pipe\\discord-ipc-${index}`);this.socket=socket;const decoder=new RPCDecoder();let established=false;
    const timeout=setTimeout(()=>{if(this.socket===socket)this.fail('Discord não respondeu. Tentando reconectar…')},5000);timeout.unref();
    socket.once('connect',()=>{established=true;if(this.socket===socket)socket.write(rpcFrame(0,{v:1,client_id:this.config.clientId}))});
    socket.on('error',()=>{clearTimeout(timeout);if(this.socket!==socket)return;if(!established){this.socket=null;socket.destroy();this.open(index+1)}else this.fail('Conexão com Discord interrompida.')});
    socket.on('close',()=>{clearTimeout(timeout);if(this.socket===socket)this.fail('Discord desconectado. Tentando reconectar…')});
    socket.on('data',(chunk:Buffer)=>{
      if(this.socket!==socket)return;
      try{for(const {op,data} of decoder.push(chunk)){
        if(op===3){socket.write(rpcFrame(4,data));continue}
        if(op===2){this.fail('Discord recusou a conexão. Confira o Application ID.');return}
        if(op!==1)continue;
        if(data.evt==='ERROR'){const code=Number.isInteger(data.data?.code)?` (${data.data.code})`:'';this.fail(`Discord recusou a atividade${code}. Tente reconectar sua conta.`);return}
        if(data.evt==='CURRENT_USER_UPDATE'&&this.accountId&&data.data?.id!==this.accountId){this.ready=false;this.fail('Abra no Discord desktop a mesma conta conectada ao Caduceus.');return}
        if(data.evt==='READY'){
          if(this.requireAccount&&(!this.accountId||data.data?.user?.id!==this.accountId)){this.fail('Abra no Discord desktop a mesma conta conectada ao Caduceus.');return}
          clearTimeout(timeout);this.ready=true;this.message='Discord conectado';this.publish();this.tick();
        }
        else if(data.cmd==='SET_ACTIVITY'&&data.nonce===this.pending?.nonce){
          const sent=this.pending!;this.pending=null;
          this.message=sent.hasActivity?`Enviado ao Discord · ${sent.game}`:'Conectado · aguardando um jogo no PS2';
          this.publish();this.tick();
        }
      }}catch{this.fail('Resposta inválida do Discord.')}
    });
  }
}
