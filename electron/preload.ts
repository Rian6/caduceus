import { contextBridge, ipcRenderer } from 'electron';
const on=(channel:string,cb:(d:any)=>void)=>{const h=(_e:any,d:any)=>cb(d);ipcRenderer.on(channel,h);return()=>ipcRenderer.removeListener(channel,h)};
contextBridge.exposeInMainWorld('games',{
 discordStatus:()=>ipcRenderer.invoke('discord:get'),discordConfigure:(enabled:boolean)=>ipcRenderer.invoke('discord:set',enabled),discordConnect:()=>ipcRenderer.invoke('discord:connect'),discordDisconnect:()=>ipcRenderer.invoke('discord:disconnect'),onDiscordStatus:(cb:(data:any)=>void)=>on('discord:status',cb),
 xeraStatus:()=>ipcRenderer.invoke('xera:status'),xeraStart:()=>ipcRenderer.invoke('xera:start'),xeraStop:()=>ipcRenderer.invoke('xera:stop'),xeraElf:()=>ipcRenderer.invoke('xera:elf'),
 onXeraStatus:(cb:(data:any)=>void)=>on('xera:status',cb),onXeraUnlock:(cb:(data:any)=>void)=>on('xera:unlock',cb),
 raStatus:()=>ipcRenderer.invoke('ra:status'),
 raCompatibilitySync:()=>ipcRenderer.invoke('ra:compatibility-sync'),
 raConnect:(user:string,key:string,password:string)=>ipcRenderer.invoke('ra:connect',user,key,password),
 raDisconnect:()=>ipcRenderer.invoke('ra:disconnect'),
 raGames:(page:number)=>ipcRenderer.invoke('ra:games',page),
 raGame:(id:number)=>ipcRenderer.invoke('ra:game',id),
 importCatalog:()=>ipcRenderer.invoke('catalog:import'),
 backupCatalog:()=>ipcRenderer.invoke('catalog:backup'),
 networkSettings:()=>ipcRenderer.invoke('network:get'), setOplPort:(port:number)=>ipcRenderer.invoke('network:set-port',port),
 storageSettings:()=>ipcRenderer.invoke('storage:get'), selectStorageDirectory:()=>ipcRenderer.invoke('storage:select'),
 changeStorageDirectory:(input:{directory:string;mode:'move'|'fresh'})=>ipcRenderer.invoke('storage:change',input),
 onStorageProgress:(cb:(data:any)=>void)=>on('storage:progress',cb),
 list:(args:any)=>ipcRenderer.invoke('games:list',args), create:(game:any)=>ipcRenderer.invoke('game:create',game), update:(game:any)=>ipcRenderer.invoke('game:update',game), installed:()=>ipcRenderer.invoke('games:installed'), repairCovers:()=>ipcRenderer.invoke('covers:repair'), stats:()=>ipcRenderer.invoke('games:stats'),
 download:(game:any,choice?:any)=>ipcRenderer.invoke('download:start',game,choice), downloads:()=>ipcRenderer.invoke('download:list'), delete:(game:any)=>ipcRenderer.invoke('game:delete',game),
 onDownloadProgress:(cb:(d:any)=>void)=>on('download:progress',cb), onDownloadCompleted:(cb:(d:any)=>void)=>on('download:completed',cb), onDownloadError:(cb:(d:any)=>void)=>on('download:error',cb),
 selectIso:()=>ipcRenderer.invoke('iso:select'), importIso:(sourcePath:string,game:any,overwrite=false)=>ipcRenderer.invoke('iso:import',sourcePath,game,overwrite), onIsoProgress:(cb:(d:any)=>void)=>on('iso:progress',cb), onIsoCompleted:(cb:(d:any)=>void)=>on('iso:completed',cb),
 oplStatus:()=>ipcRenderer.invoke('opl:status'), onOplStatus:(cb:(d:any)=>void)=>on('opl:status',cb),
 nowPlaying:()=>ipcRenderer.invoke('now-playing:get'), onNowPlaying:(cb:(d:any)=>void)=>on('now-playing:changed',cb)
});

contextBridge.exposeInMainWorld('ps2Activity', {
  getNowPlaying: () => ipcRenderer.invoke('now-playing:get'),
  onNowPlayingChanged: (callback: (game: any) => void) => {
    const listener = (_event: any, game: any) => callback(game);
    ipcRenderer.on('now-playing:changed', listener);
    return () => ipcRenderer.removeListener('now-playing:changed', listener);
  }
});
