import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// PS2 identification: MD5 of the BOOT2 executable name + executable bytes.
// https://docs.retroachievements.org/developer-docs/game-identification.html
export async function hashPS2(file:string):Promise<string>{
  const handle=await fs.open(file,'r');
  try{
    const stat=await handle.stat();
    async function read(offset:number,length:number){
      if(offset<0||length<0||offset+length>stat.size)throw new Error('Imagem truncada.');
      const buffer=Buffer.alloc(length);let done=0;
      while(done<length){const {bytesRead}=await handle.read(buffer,done,length-done,offset+done);if(!bytesRead)throw new Error('Imagem truncada.');done+=bytesRead}
      return buffer;
    }
    const pvd=await read(16*2048,2048);
    if(pvd[0]!==1||pvd.toString('ascii',1,6)!=='CD001'||pvd.readUInt16LE(128)!==2048)throw new Error('Formato não suportado. Use uma ISO de PS2 com setores de 2048 bytes.');
    type Entry={offset:number;size:number;directory:boolean};
    const entry=(b:Buffer,p:number):Entry=>({offset:b.readUInt32LE(p+2)*2048,size:b.readUInt32LE(p+10),directory:!!(b[p+25]&2)});
    const root=entry(pvd,156);
    async function find(name:string){
      let current=root;
      const parts=name.split(/[\\/]/).filter(Boolean);
      if(parts.length>16||parts.some(p=>p==='.'||p==='..'))throw new Error('Caminho do executável inválido.');
      for(const part of parts){
        if(!current.directory||current.size>16*1024*1024)throw new Error('Diretório ISO inválido.');
        const data=await read(current.offset,current.size);let found:Entry|undefined;
        for(let p=0;p<data.length;){
          const length=data[p];if(!length){p=(Math.floor(p/2048)+1)*2048;continue}
          if(length<34||p+length>data.length||33+data[p+32]>length)throw new Error('Diretório ISO inválido.');
          const fileName=data.toString('ascii',p+33,p+33+data[p+32]).replace(/;\d+$/,'');
          if(fileName.toUpperCase()===part.toUpperCase()){
            if(data[p+25]&128)throw new Error('Arquivo ISO com múltiplas extensões não suportado.');
            found=entry(data,p);break;
          }
          p+=length;
        }
        if(!found)throw new Error('Executável ou SYSTEM.CNF não encontrado na ISO.');
        current=found;
      }
      return current;
    }
    const config=await find('SYSTEM.CNF');
    if(config.directory||config.size>65536)throw new Error('SYSTEM.CNF inválido.');
    const text=(await read(config.offset,config.size)).toString('latin1');
    const match=text.match(/(?:^|\n)\s*BOOT2\s*=\s*(?:cdrom0:)?\\*([^;\s]+)/);
    if(!match||Buffer.byteLength(match[1],'latin1')>63)throw new Error('BOOT2 inválido ou ausente.');
    const name=match[1],exe=await find(name);
    if(exe.directory||exe.size<4||exe.size>64*1024*1024)throw new Error('Executável de PS2 inválido ou grande demais.');
    const hash=createHash('md5').update(Buffer.from(name,'latin1'));
    for(let p=0;p<exe.size;p+=1024*1024)hash.update(await read(exe.offset+p,Math.min(1024*1024,exe.size-p)));
    const after=await handle.stat();
    if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('A ISO mudou durante a leitura. Tente novamente.');
    return hash.digest('hex');
  }finally{await handle.close()}
}
