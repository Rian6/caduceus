/// <reference types="vite/client" />
type DownloadState={gameKey:string;fileName:string;url:string;path:string;icon?:string|null;state:string;received:number;total:number;percent:number;gameId?:string|null;coverInstalled?:boolean;error?:string};
type DownloadOption={name?:string;url:string;region?:string;format?:string;size?:string;source?:string;originalName?:string};
type Game={_id:string;title:string;console:string;icon?:string|null;originalName?:string|null;downloadUrl?:string|null;downloads?:DownloadOption[];source?:string|null;gameId?:string|null;coverInstalled?:boolean;downloaded?:boolean;localFileName?:string;downloadState?:DownloadState|null};
type OplStatus={online:boolean;ip:string;port:number;folder:string;shareName:string};
type NowPlaying={id?:number;title:string;gameId?:string|null;icon?:string|null;fileName:string;filePath?:string;active?:boolean};
interface Window { games: GamesAPI }
interface GamesAPI {
 raStatus:()=>Promise<{user:string|null}>;
 raConnect:(user:string,key:string)=>Promise<{user:string|null}>;
 raDisconnect:()=>Promise<{user:string|null}>;
 raGames:(page:number)=>Promise<{total:number;games:RAGame[]}>;
 raGame:(id:number)=>Promise<{title:string;achievements:RAAchievement[]}>;
 backupCatalog:()=>Promise<{cancelled:boolean;backup?:string}>;
 importCatalog:()=>Promise<{cancelled:boolean;added?:number;skipped?:number;backup?:string}>;
 networkSettings:()=>Promise<NetworkSettings>;
 setOplPort:(port:number)=>Promise<NetworkSettings>;
 storageSettings:()=>Promise<StorageSettings>;
 selectStorageDirectory:()=>Promise<string|null>;
 changeStorageDirectory:(input:{directory:string;mode:'move'|'fresh'})=>Promise<{cancelled:boolean;directory?:string;warning?:string}>;
 onStorageProgress:(callback:(progress:StorageProgress)=>void)=>()=>void;
 nowPlaying:()=>Promise<NowPlaying|null>;
 onNowPlaying:(cb:(game:NowPlaying|null)=>void)=>()=>void;
}
type RAGame={id:number;title:string;console:string;image:string|null;total:number;earned:number;hardcore:number};
type RAAchievement={id:number;title:string;description:string;points:number;image:string|null;earned:boolean;hardcore:boolean;date:string};
type StorageSettings={directory:string;isoDirectory:string;exists:boolean;bytes:number;isoCount:number;busy:boolean};
type NetworkSettings=OplStatus & {addresses:string[]};
type StorageProgress={phase:string;received:number;total:number;file?:string};
interface GamesAPI{list:(args:any)=>Promise<{games:Game[];total:number;page:number;pages:number}>;create:(game:any)=>Promise<Game>;update:(game:any)=>Promise<Game>;installed:()=>Promise<Game[]>;repairCovers:()=>Promise<{repaired:number;missingId:number;missingCover:number;total:number}>;stats:()=>Promise<any>;download:(game:Game,choice?:DownloadOption)=>Promise<any>;downloads:()=>Promise<DownloadState[]>;delete:(game:Game)=>Promise<any>;selectIso:()=>Promise<{path:string;fileName:string;size:number;suggestedTitle:string}|null>;importIso:(sourcePath:string,game:Game,overwrite?:boolean)=>Promise<any>;onIsoProgress:(cb:(d:any)=>void)=>()=>void;onIsoCompleted:(cb:(d:any)=>void)=>()=>void;onDownloadProgress:(cb:(d:DownloadState)=>void)=>()=>void;onDownloadCompleted:(cb:(d:DownloadState)=>void)=>()=>void;onDownloadError:(cb:(d:DownloadState)=>void)=>()=>void;oplStatus:()=>Promise<OplStatus>;onOplStatus:(cb:(d:OplStatus)=>void)=>()=>void}
