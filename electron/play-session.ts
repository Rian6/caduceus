// Once a console has streamed telemetry, its disconnect invalidates any SMB
// handle left open for that session. A different image is a new session.
export class PlaySession {
  private live=false;
  private file='';
  private blocked='';
  console(connected:boolean){
    if(this.live&&!connected)this.blocked=this.file;
    if(connected)this.blocked='';
    this.live=connected;
  }
  resolve<T extends {filePath?:string;fileName?:string;icon?:string|null;id?:number;gameId?:string|null}>(smb:T|null,telemetry:T|null):T|null{
    const file=smb?.filePath||'';
    if(file&&this.blocked&&file!==this.blocked)this.blocked='';
    if(file)this.file=file;
    if(telemetry&&smb&&(!telemetry.gameId||!smb.gameId||telemetry.gameId===smb.gameId)){
      // RA titles can differ from catalog titles. The currently open ISO has
      // the catalog identity and cover; telemetry supplies the live title.
      return {...smb,...telemetry,icon:telemetry.icon||smb.icon,
        id:telemetry.id??smb.id,gameId:telemetry.gameId||smb.gameId,
        filePath:smb.filePath,fileName:smb.fileName};
    }
    return telemetry||(file&&file===this.blocked?null:smb);
  }
}

// SSE keeps flowing even if the console stops sending UDP packets.
export class ConsoleHeartbeat {
  private packets:number|undefined;
  private changedAt=0;
  update(connected:boolean,packets:unknown,now=Date.now()){
    if(!connected){this.packets=undefined;this.changedAt=0;return false}
    if(typeof packets!=='number'||!Number.isFinite(packets))return connected;
    if(packets!==this.packets){this.packets=packets;this.changedAt=now}
    return now-this.changedAt<15000;
  }
}
