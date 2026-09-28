import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export type RALogin={user:string;key:string};
export interface LoginStore {load:()=>RALogin|null;save:(login:RALogin)=>void;clear:()=>void}
type Encryption={isEncryptionAvailable:()=>boolean;encryptString:(value:string)=>Buffer;decryptString:(value:Buffer)=>string};

export class RALoginCache implements LoginStore {
  constructor(private file:()=>string,private encryption:Encryption){}
  load():RALogin|null {
    try {
      if(!this.encryption.isEncryptionAvailable()||!fs.existsSync(this.file()))return null;
      const value=JSON.parse(this.encryption.decryptString(fs.readFileSync(this.file())));
      return typeof value.user==='string'&&value.user.trim()&&value.user.length<=100&&typeof value.key==='string'&&value.key.trim()&&value.key.length<=256?value:null;
    } catch {return null} // A corrupt or undecryptable cache allows a fresh login.
  }
  save(login:RALogin){
    if(!this.encryption.isEncryptionAvailable())throw new Error('Não foi possível proteger o login neste computador. Tente novamente após reiniciar o aplicativo.');
    const file=this.file(),temporary=file+'.tmp-'+randomUUID();
    try {
      const encrypted=this.encryption.encryptString(JSON.stringify(login));
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(temporary,encrypted,{mode:0o600});
      fs.renameSync(temporary,file);
    } catch {throw new Error('Não foi possível salvar o login protegido. Confira as permissões da pasta de dados do aplicativo.');}
    finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
  }
  clear(){
    try{fs.rmSync(this.file(),{force:true})}catch{throw new Error('Não foi possível remover o login salvo. Confira as permissões e tente desconectar novamente.');}
  }
}
