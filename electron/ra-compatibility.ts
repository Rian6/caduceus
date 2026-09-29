import fs from 'node:fs';
import path from 'node:path';
import {hashPS2} from './ra-iso';
export type RACompatible={status:'compatible'|'unmatched'|'unknown'|'unsupported'|'error';hash?:string;id?:number;title?:string;image?:string|null;count?:number;checkedAt?:number;message?:string;fileName?:string};
type IndexGame={id:number;title:string;image:string|null;count:number;hashes:string[]};
export class RACompatibility{
  private index:{at:number;games:IndexGame[]}|null=null;
  private hashes=new Map<string,IndexGame>();
  private files=new Map<string,{stamp:string;hash:string}>();
  private pending:Promise<void>|null=null;
  private attempted=0;
  private loaded=false;
  constructor(private cacheFile:()=>string,private fetchIndex:()=>Promise<IndexGame[]>){ }
  private restore(){
    if(this.loaded)return;this.loaded=true;
    try{const data=JSON.parse(fs.readFileSync(this.cacheFile(),'utf8'));if(data.version===1&&Number.isFinite(data.at)&&Array.isArray(data.games)&&data.games.every((g:any)=>Number.isSafeInteger(g.id)&&typeof g.title==='string'&&Number.isFinite(g.count)&&Array.isArray(g.hashes)&&g.hashes.every((h:any)=>typeof h==='string'&&/^[a-f0-9]{32}$/.test(h))))this.setIndex({at:data.at,games:data.games})}catch{}
  }
  private setIndex(index:{at:number;games:IndexGame[]}){this.index=index;this.hashes.clear();for(const game of index.games)for(const hash of game.hashes)this.hashes.set(hash,game)}
  async sync(force=false){
    this.restore();
    if(this.pending)return this.pending;
    // Public hash catalog changes slowly; never fetch on each card or refresh.
    if(this.index&&Date.now()-this.index.at<24*60*60*1000)return;
    if(!force&&Date.now()-this.attempted<60000)return;
    this.attempted=Date.now();
    this.pending=(async()=>{
      const games=await this.fetchIndex();const index={at:Date.now(),games};
      fs.mkdirSync(path.dirname(this.cacheFile()),{recursive:true});
      const temp=this.cacheFile()+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:1,...index}));fs.renameSync(temp,this.cacheFile());this.setIndex(index);
    })();
    try{await this.pending}finally{this.pending=null}
  }
  async check(file?:string):Promise<RACompatible>{
    if(!file)return{status:'unknown',message:'Baixe ou importe a ISO para validar esta versão.'};
    const fileName=path.basename(file);
    if(path.extname(file).toLowerCase()!=='.iso')return{status:'unsupported',fileName,message:'Validação disponível para arquivos ISO de PS2.'};
    try{await this.sync()}catch{}
    if(!this.index)return{status:'unknown',fileName,message:'Conecte sua conta e atualize a compatibilidade RA.'};
    try{
      const stat=await fs.promises.stat(file),stamp=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
      let cached=this.files.get(file);
      if(!cached||cached.stamp!==stamp){cached={stamp,hash:await hashPS2(file)};if(this.files.size>2000)this.files.clear();this.files.set(file,cached)}
      const game=this.hashes.get(cached.hash),base={hash:cached.hash,checkedAt:this.index.at,fileName};
      return game&&game.count>0?{...base,status:'compatible',id:game.id,title:game.title,image:game.image,count:game.count}:{...base,status:'unmatched',message:'Hash não encontrado entre as imagens com conquistas ativas.'};
    }catch{return{status:'error',fileName,message:'Não foi possível ler esta ISO. Verifique se o arquivo está completo e em formato ISO de PS2.'}}
  }
}
