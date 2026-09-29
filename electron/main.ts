import { app, BrowserWindow, ipcMain, session, nativeImage, dialog, safeStorage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import dgram from 'dgram';
import { spawn, ChildProcess } from 'child_process';
import { DatabaseSync } from 'node:sqlite';
import { OplActivityMonitor } from './opl-activity';
import { OplStorage, StorageMode, validatePort } from './storage';
import {assertPortAvailable, localAddresses} from './network';
import {importCatalog} from './catalog-import';
import {saveCatalogBackup} from './catalog-backup';
import {deleteCatalogGame,prepareDeletedGames} from './catalog-delete';
import {RetroAchievements} from './retroachievements';
import {DiscordPresence} from './discord-presence';
import {PlaySession} from './play-session';
const playSession=new PlaySession();
import {DiscordAuth} from './discord-auth';
import {DISCORD_CLIENT_ID} from './discord-config';
const discordAuth=new DiscordAuth(()=>DISCORD_CLIENT_ID,()=>path.join(app.getPath('userData'),'cache','discord-login.enc'),safeStorage,url=>shell.openExternal(url));
const discord=new DiscordPresence(()=>path.join(app.getPath('userData'),'discord-presence.json'),()=>broadcast('discord:status',discordStatus()));
discord.requireAccount=true;
function discordStatus(){const {clientId,...status}=discord.status();return{...status,user:discordAuth.user(),configured:discordAuth.configured()}}
let discordAuthBusy=false;
handle('discord:get',()=>discordStatus());
handle('discord:set',(_event,enabled:unknown)=>{
  if(typeof enabled!=='boolean')throw Error('Configuração inválida.');
  if(enabled&&!discordAuth.user())throw Error('Conecte sua conta Discord primeiro.');
  discord.configure({enabled,clientId:DISCORD_CLIENT_ID});return discordStatus();
});
handle('discord:connect',async()=>{
  if(discordAuthBusy)throw Error('Aguarde a autorização no navegador.');discordAuthBusy=true;
  try{const user=await discordAuth.login();discord.setAccount(user.id);discord.configure({enabled:true,clientId:DISCORD_CLIENT_ID});return discordStatus()}finally{discordAuthBusy=false}
});
handle('discord:disconnect',async()=>{
  discord.setAccount(null);discord.configure({enabled:false,clientId:DISCORD_CLIENT_ID});await discordAuth.disconnect();broadcast('discord:status',discordStatus());return discordStatus();
});
import {RACompatibility} from './ra-compatibility';
const compatibility=new RACompatibility(()=>path.join(app.getPath('userData'),'cache','ra-compatibility.json'),()=>achievements.compatibilityIndex());
handle('ra:compatibility-sync',async()=>{await compatibility.sync(true);return true});
import {Xerabora,XERA_PORT} from './xerabora';
const xeraDirectory=()=>app.isPackaged?path.join(process.resourcesPath,'xerabora'):path.join(__dirname,'..','vendor','xerabora');
const xera=new Xerabora(xeraDirectory,(channel,value)=>{if(channel==='xera:unlock'){achievements.invalidate();discord.unlock(value)}if(channel==='xera:status'){playSession.console(value.connected);const row=value.connected&&value.game?database().prepare('SELECT icon FROM games WHERE title = ? COLLATE NOCASE LIMIT 1').get(value.game) as {icon?:string}|undefined:undefined;discord.updateConsole({...value,icon:row?.icon});}broadcast(channel,value)},()=>path.join(app.getPath('userData'),'achievement-engine'));
handle('xera:status',()=>xera.status());
handle('xera:start',()=>xera.start());
handle('xera:stop',()=>xera.stop());
handle('xera:elf',async()=>{const result=await dialog.showSaveDialog({title:'Salvar OPL-RA para o PS2',defaultPath:'OPL-RA.ELF',filters:[{name:'Executável PS2',extensions:['ELF']}]});if(!result.canceled&&result.filePath){fs.copyFileSync(path.join(xeraDirectory(),'OPL-RA.ELF'),result.filePath);return true}return false});
app.on('before-quit',()=>xera.stop());

import {RALoginCache} from './ra-login-cache';
const achievements=new RetroAchievements(fetch,new RALoginCache(()=>path.join(app.getPath('userData'),'cache','retroachievements-login.enc'),safeStorage));
handle('ra:status',()=>achievements.status());
let achievementAccountBusy=false;
handle('ra:connect',async(_event,user:unknown,key:unknown,password:unknown)=>{
  if(achievementAccountBusy)throw new Error('Aguarde a conexão atual terminar.');achievementAccountBusy=true;
  try{return await achievements.connect(user,key,()=>xera.login(user,password))}finally{achievementAccountBusy=false}
});
handle('ra:disconnect',async()=>{
  if(achievementAccountBusy)throw new Error('Aguarde a conexão atual terminar.');achievementAccountBusy=true;
  try{await xera.logout();return achievements.disconnect()}finally{achievementAccountBusy=false}
});
handle('ra:games',(_event,page:unknown)=>achievements.games(page));
handle('ra:game',(_event,id:unknown)=>achievements.game(id));

function oplPort(){return storage().port}
let db:DatabaseSync|null=null;
let oplProcess:ChildProcess|null=null;
let storageChanging = false;
let trackedRequests = 0;
let selectedStorageTarget: string | null = null;

function handle(channel:string, listener:Parameters<typeof ipcMain.handle>[1]) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (channel === 'opl:status' || channel === 'now-playing:get') return listener(event, ...args);
    if (storageChanging) throw new Error('Aguarde a alteração da pasta do OPL Server terminar.');
    trackedRequests++;
    try {return await listener(event, ...args)} finally {trackedRequests--}
  });
}

type DownloadState={ra?:import('./ra-compatibility').RACompatible;gameKey:string;fileName:string;url:string;path:string;icon?:string|null;state:'starting'|'progressing'|'completed'|'cancelled'|'interrupted'|'processing';received:number;total:number;percent:number;gameId?:string|null;coverInstalled?:boolean;error?:string};
const downloads=new Map<string,DownloadState>();
let catalogImportBusy = false;
handle('catalog:backup', async () => {
  if (catalogImportBusy) throw new Error('Aguarde a operação atual da base terminar.');
  catalogImportBusy = true;
  try {
    const selected = await dialog.showSaveDialog({title:'Salvar backup da base de jogos',defaultPath:path.join(app.getPath('documents'),`catalogo-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite3`),filters:[{name:'Base SQLite',extensions:['sqlite3']}],properties:['showOverwriteConfirmation','createDirectory']});
    if (selected.canceled || !selected.filePath) return {cancelled:true};
    const backup = saveCatalogBackup(database(), dbPath(), selected.filePath);
    return {cancelled:false,backup};
  } finally {catalogImportBusy = false}
});
handle('catalog:import', async () => {
  if (catalogImportBusy) throw new Error('Já existe uma importação em andamento.');
  catalogImportBusy = true;
  try {
    const selected = await dialog.showOpenDialog({title:'Importar base de jogos',properties:['openFile'],filters:[{name:'Base de jogos (SQLite ou JSON)',extensions:['sqlite3','sqlite','db','json']}]});
    if (selected.canceled || !selected.filePaths[0]) return {cancelled:true};
    return importCatalog(database(), selected.filePaths[0], path.join(path.dirname(dbPath()), 'backups'));
  } finally {catalogImportBusy = false}
});

function dataRoot(){return path.join(app.getPath('documents'),'Caduceus')}
let storageInstance: OplStorage | null = null;
function storage(){return storageInstance ||= new OplStorage(path.join(dataRoot(),'oplserver'),resourceOplDir(),path.join(app.getPath('userData'),'settings.json'),[process.cwd(),app.getPath('userData'),path.dirname(app.getPath('exe'))])}
function runtimeOplDir(){return storage().root}
function resourceOplDir(){return app.isPackaged?path.join(process.resourcesPath,'oplserver'):path.join(process.cwd(),'oplserver')}
function shareDir(){return path.join(runtimeOplDir(),'PS2')}
function dvdDir(){ensureRuntime();return path.join(shareDir(),'DVD')}
function artDir(){ensureRuntime();return path.join(shareDir(),'ART')}
function oplExe(){return path.join(runtimeOplDir(),'OPLServer.exe')}
function dbPath(){
  // Em desenvolvimento, usa EXATAMENTE o SQLite gerado por npm run migrate:mongo.
  // Isso evita abrir uma cópia antiga em %APPDATA% e mostrar só parte do catálogo.
  return app.isPackaged
    ? path.join(app.getPath('userData'),'catalog.sqlite3')
    : path.join(process.cwd(),'database','catalog.sqlite3')
}
function seedDbPath(){return app.isPackaged?path.join(process.resourcesPath,'database','catalog.sqlite3'):path.join(process.cwd(),'database','catalog.sqlite3')}
function ensureRuntime(){storage().ensure()}
function syncPackagedSeed(target:DatabaseSync){
  if(!app.isPackaged)return;
  const seed=seedDbPath();
  if(!fs.existsSync(seed)||path.resolve(seed)===path.resolve(dbPath()))return;
  let source:DatabaseSync|null=null;
  try{
    source=new DatabaseSync(seed,{readOnly:true});
    const seedCount=Number((source.prepare('SELECT COUNT(*) AS n FROM games').get() as any)?.n||0);
    const localCount=Number((target.prepare('SELECT COUNT(*) AS n FROM games').get() as any)?.n||0);
    if(seedCount<=localCount)return;
    const rows=source.prepare('SELECT * FROM games ORDER BY id').all() as any[];
    const insert=target.prepare(`INSERT OR IGNORE INTO games(
      mongo_id,title,console,icon,original_name,source,source_page,game_id,cover_installed,
      download_url,downloads_json,size,raw_json,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    target.exec('BEGIN');
    try{
      const excluded=target.prepare('SELECT 1 FROM deleted_seed_games WHERE title=? AND console=?');
      for(const r of rows)if(!excluded.get(r.title,r.console||'PS2'))insert.run(
        r.mongo_id??null,r.title,r.console||'PS2',r.icon??null,r.original_name??null,r.source??null,
        r.source_page??null,r.game_id??null,Number(r.cover_installed||0),r.download_url??null,
        r.downloads_json||'[]',r.size??null,r.raw_json??null,r.created_at||new Date().toISOString(),
        r.updated_at||new Date().toISOString()
      );
      target.exec('COMMIT');
    }catch(e){target.exec('ROLLBACK');throw e}
  }finally{try{source?.close()}catch{}}
}
function database(){
  if(db)return db;
  fs.mkdirSync(path.dirname(dbPath()),{recursive:true});
  const seed=seedDbPath();
  if(!fs.existsSync(dbPath())&&fs.existsSync(seed))fs.copyFileSync(seed,dbPath());
  db=new DatabaseSync(dbPath());
  // Primeiro garante apenas a tabela base. Índices que dependem de colunas
  // adicionadas por migração só podem ser criados DEPOIS dos ALTER TABLE.
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS games(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mongo_id TEXT,
      title TEXT NOT NULL,
      console TEXT NOT NULL DEFAULT 'PS2',
      icon TEXT, original_name TEXT, source TEXT, source_page TEXT,
      game_id TEXT, cover_installed INTEGER NOT NULL DEFAULT 0,
      download_url TEXT, downloads_json TEXT NOT NULL DEFAULT '[]',
      size TEXT, raw_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);

  // Migra automaticamente bancos criados por versões anteriores do app.
  let cols=(db.prepare('PRAGMA table_info(games)').all() as any[]).map(x=>String(x.name));
  const addColumn=(name:string,sql:string)=>{
    if(!cols.includes(name)){ db!.exec(`ALTER TABLE games ADD COLUMN ${sql}`); cols.push(name); }
  };
  addColumn('mongo_id','mongo_id TEXT');
  addColumn('raw_json','raw_json TEXT');
  addColumn('source_page','source_page TEXT');
  addColumn('game_id','game_id TEXT');
  addColumn('cover_installed','cover_installed INTEGER NOT NULL DEFAULT 0');
  addColumn('download_url','download_url TEXT');
  addColumn('downloads_json',"downloads_json TEXT NOT NULL DEFAULT '[]'");
  addColumn('size','size TEXT');

  // Só agora cria os índices: neste ponto mongo_id existe até em bancos antigos.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_games_title_console ON games(title COLLATE NOCASE,console);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_games_mongo_id ON games(mongo_id) WHERE mongo_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS ix_games_title ON games(title COLLATE NOCASE);
  `);
  // Em builds instalados, incorpora jogos que existam no catálogo empacotado
  // mas ainda não estejam no banco persistente de uma instalação anterior.
  prepareDeletedGames(db);
  syncPackagedSeed(db);
  return db;
}
function parseDownloads(v:any){try{const a=JSON.parse(String(v||'[]'));return Array.isArray(a)?a:[]}catch{return[]}}
function rowToGame(r:any){return{_id:String(r.id),title:r.title,console:r.console,icon:r.icon,originalName:r.original_name,source:r.source,sourcePage:r.source_page,gameId:r.game_id,coverInstalled:!!r.cover_installed,downloadUrl:r.download_url,downloads:parseDownloads(r.downloads_json),size:r.size,createdAt:r.created_at,updatedAt:r.updated_at}}
function safeName(n:string){return path.basename(n).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_')}
function downloadOptions(g:any){const list=Array.isArray(g.downloads)?g.downloads.filter((d:any)=>d?.url):[];if(list.length)return list;return g.downloadUrl?[{name:'Download',url:g.downloadUrl,originalName:g.originalName||null,region:null,format:null,size:g.size||null,source:g.source||null}]:[]}
function fileNameForDownload(g:any,d?:any){if(d?.originalName)return safeName(String(d.originalName));if(g.originalName&&!d)return safeName(String(g.originalName));const raw=String(d?.url||g.downloadUrl||'');try{const u=new URL(raw);return safeName(decodeURIComponent(path.basename(u.pathname))||`${g.title}.iso`)}catch{return safeName(`${g.title}.iso`)}}
function fileNameForGame(g:any){return fileNameForDownload(g,downloadOptions(g)[0])}
function gameKey(g:any){return String(g._id||g.id||g.downloadUrl||fileNameForGame(g))}
function broadcast(ch:string,data:any){for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())w.webContents.send(ch,data)}

async function localIPv4(){return await new Promise<string>(resolve=>{const s=dgram.createSocket('udp4');let done=false;const finish=(v:string)=>{if(done)return;done=true;try{s.close()}catch{}resolve(v==='127.0.0.1'?(localAddresses()[0]||v):v)};s.once('error',()=>finish('127.0.0.1'));s.connect(53,'8.8.8.8',()=>{try{const a=s.address();finish(typeof a==='object'?a.address:'127.0.0.1')}catch{finish('127.0.0.1')}});setTimeout(()=>finish('127.0.0.1'),800)})}
async function portOnline(){return await new Promise<boolean>(resolve=>{const s=net.createConnection({host:'127.0.0.1',port:oplPort()});let done=false;const end=(v:boolean)=>{if(done)return;done=true;s.destroy();resolve(v)};s.setTimeout(450);s.once('connect',()=>end(true));s.once('error',()=>end(false));s.once('timeout',()=>end(false))})}
async function oplStatus(){if(!storageChanging)ensureRuntime();return{online:storageChanging?false:await portOnline(),ip:await localIPv4(),port:oplPort(),folder:shareDir(),shareName:'PS2'}}
let serverStarting = false;
async function startOpl(){
  serverStarting = true;
  try {
    ensureRuntime();
    if(await portOnline()) return oplStatus();
    const child=spawn(oplExe(),['/START','/NOLOG'],{cwd:runtimeOplDir(),windowsHide:true,stdio:'ignore'});
    oplProcess=child;
    child.once('exit',()=>{if(oplProcess===child)oplProcess=null;if(!storageChanging)void publishOpl()});
    child.once('error',e=>broadcast('opl:error',{message:e.message}));
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,250));if(await portOnline())break}
    return oplStatus();
  } finally {serverStarting=false}
}
async function publishOpl(){const s=await oplStatus();broadcast('opl:status',s);return s}

function extractGameId(filePath:string){const fd=fs.openSync(filePath,'r');try{const stat=fs.fstatSync(fd);const chunk=1024*1024,overlap=256,scanLimit=Math.min(stat.size,128*1024*1024);let pos=0,tail=Buffer.alloc(0);while(pos<scanLimit){const len=Math.min(chunk,scanLimit-pos),b=Buffer.allocUnsafe(len);fs.readSync(fd,b,0,len,pos);const data=Buffer.concat([tail,b]).toString('latin1');const m=data.match(/BOOT2?\s*=\s*cdrom0:\\+([A-Z]{4}[_-]\d{3}\.\d{2})/i)||data.match(/\b([A-Z]{4}[_-]\d{3}\.\d{2})\b/i);if(m)return m[1].toUpperCase().replace('-','_');tail=b.subarray(Math.max(0,b.length-overlap));pos+=len}return null}finally{fs.closeSync(fd)}}
async function installCover(icon:string|undefined|null,id:string|null){if(!icon||!id)return false;try{const res=await fetch(icon,{redirect:'follow'});if(!res.ok)return false;const buf=Buffer.from(await res.arrayBuffer());const image=nativeImage.createFromBuffer(buf);if(image.isEmpty())return false;fs.writeFileSync(path.join(artDir(),`${id}_COV.jpg`),image.resize({width:140,height:200,quality:'best'}).toJPEG(92));return true}catch{return false}}
async function finishGame(state:DownloadState){let id:string|null=null;try{id=extractGameId(state.path)}catch{}const cover=await installCover(state.icon,id);if(id)database().prepare('UPDATE games SET game_id=?,cover_installed=?,updated_at=? WHERE id=?').run(id,cover?1:0,new Date().toISOString(),Number(state.gameKey));const next:DownloadState={...state,state:'completed',percent:100,gameId:id,coverInstalled:cover,ra:await compatibility.check(state.path)};downloads.set(state.gameKey,next);broadcast('download:completed',next)}

async function copyIsoToLibrary(sourcePath:string, game:any, overwrite=false){
  if(!sourcePath || !fs.existsSync(sourcePath)) throw new Error('Arquivo ISO não encontrado.');
  if(path.extname(sourcePath).toLowerCase()!=='.iso') throw new Error('Selecione um arquivo .iso.');
  const stat=fs.statSync(sourcePath);
  if(!stat.isFile()) throw new Error('O caminho selecionado não é um arquivo.');
  const fileName=safeName(path.basename(sourcePath));
  const target=path.join(dvdDir(),fileName);
  if(fs.existsSync(target) && path.resolve(sourcePath)!==path.resolve(target) && !overwrite){
    return {success:false,exists:true,fileName,target,size:stat.size};
  }
  if(path.resolve(sourcePath)!==path.resolve(target)){
    await new Promise<void>((resolve,reject)=>{
      let copied=0,last=-1;
      const input=fs.createReadStream(sourcePath), output=fs.createWriteStream(target);
      const fail=(e:any)=>{try{input.destroy()}catch{};try{output.destroy()}catch{};try{if(fs.existsSync(target))fs.rmSync(target,{force:true})}catch{};reject(e)};
      input.on('data',(chunk:any)=>{copied+=chunk.length;const percent=stat.size?Math.floor(copied*100/stat.size):0;if(percent!==last){last=percent;broadcast('iso:progress',{gameKey:String(game?._id||''),fileName,received:copied,total:stat.size,percent})}});
      input.once('error',fail); output.once('error',fail); output.once('finish',resolve); input.pipe(output);
    });
  }
  let id=String(game?.gameId||'').trim().toUpperCase()||null;
  if(!id){try{id=extractGameId(target)}catch{}}
  let coverInstalled=false;
  if(id) coverInstalled=await installCover(game?.icon||null,id);
  const gameDbId=Number(game?._id);
  if(Number.isFinite(gameDbId)){
    database().prepare(`UPDATE games SET original_name=?,game_id=?,cover_installed=?,updated_at=? WHERE id=?`)
      .run(fileName,id,coverInstalled?1:0,new Date().toISOString(),gameDbId);
  }
  const result={success:true,exists:false,fileName,target,size:fs.statSync(target).size,gameId:id,coverInstalled};
  broadcast('iso:completed',{...result,gameKey:String(game?._id||'')});
  return result;
}

handle('iso:select',async()=>{
  const r=await dialog.showOpenDialog({title:'Importar ISO de PlayStation 2',properties:['openFile'],filters:[{name:'Imagem de disco PS2',extensions:['iso']}]});
  if(r.canceled||!r.filePaths[0])return null;
  const sourcePath=r.filePaths[0],stat=fs.statSync(sourcePath);
  return{path:sourcePath,fileName:path.basename(sourcePath),size:stat.size,suggestedTitle:path.parse(sourcePath).name,ra:await compatibility.check(sourcePath)};
});
handle('iso:import',async(_e,sourcePath:string,game:any,overwrite=false)=>copyIsoToLibrary(sourcePath,game,!!overwrite));

async function catalogCompatibility(g:any){
  const names=[g.originalName,...downloadOptions(g).map((o:any)=>fileNameForDownload(g,o))].filter(Boolean);
  const local=names.map((name:string)=>path.join(dvdDir(),safeName(name))).find((file:string)=>fs.existsSync(file));
  return {...g,downloaded:!!local,localFileName:local?path.basename(local):undefined,ra:await compatibility.check(local),downloadState:downloads.get(g._id)||null};
}
handle('games:list',async(_e,args:any={})=>{
  const d=database(),page=Math.max(0,Number(args.page)||0),limit=Math.min(100,Math.max(1,Number(args.limit)||20)),search=String(args.search||'').trim(),consoleName=String(args.console||'PS2');
  const where=search?'WHERE console=? AND title LIKE ? COLLATE NOCASE':'WHERE console=?',params:any[]=search?[consoleName,`%${search}%`]:[consoleName];
  if(args.raCompatible){
    const rows=d.prepare(`SELECT * FROM games ${where} ORDER BY title COLLATE NOCASE`).all(...params) as any[];
    const result=[];
    for(const row of rows){const game=await catalogCompatibility(rowToGame(row));if(game.ra.status==='compatible')result.push(game)}
    return{games:result.slice(page*limit,(page+1)*limit),total:result.length,page,pages:Math.ceil(result.length/limit)};
  }
  const rows=d.prepare(`SELECT * FROM games ${where} ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?`).all(...params,limit,page*limit) as any[];
  const total=Number((d.prepare(`SELECT COUNT(*) AS n FROM games ${where}`).get(...params) as any).n||0);
  const games=[];for(const row of rows)games.push(await catalogCompatibility(rowToGame(row)));
  return{games,total,page,pages:Math.ceil(total/limit)};
});

handle('game:create',async(_e,input:any)=>{const title=String(input?.title||'').trim();if(!title)throw new Error('Informe o título do jogo.');const icon=String(input?.icon||'').trim()||null;const downloadUrl=String(input?.downloadUrl||'').trim()||null;for(const u of [icon,downloadUrl].filter(Boolean) as string[]){const p=new URL(u);if(!['http:','https:'].includes(p.protocol))throw new Error('As URLs devem usar HTTP ou HTTPS.')}const incoming=Array.isArray(input?.downloads)?input.downloads:[];const normalized=incoming.filter((x:any)=>String(x?.url||'').trim()).map((x:any,i:number)=>{const u=new URL(String(x.url));return{name:String(x.name||`Opção ${i+1}`),url:u.toString(),region:String(x.region||''),format:String(x.format||''),size:String(x.size||''),source:String(x.source||'manual'),originalName:String(x.originalName||'')}});if(downloadUrl&&!normalized.length)normalized.push({name:'Download',url:downloadUrl,region:'',format:'',size:'',source:'manual',originalName:String(input.originalName||'')});const now=new Date().toISOString();try{const r=database().prepare(`INSERT INTO games(title,console,icon,original_name,source,download_url,downloads_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(title,'PS2',icon,String(input.originalName||''),'manual',normalized[0]?.url||null,JSON.stringify(normalized),now,now);return rowToGame(database().prepare('SELECT * FROM games WHERE id=?').get(Number(r.lastInsertRowid)))}catch(e:any){if(String(e.message).includes('UNIQUE'))throw new Error('Este jogo já está cadastrado no catálogo.');throw e}});
handle('game:update',async(_e,input:any)=>{let id=Number(input?._id);if(!Number.isFinite(id)){if(String(input?._id||'').startsWith('local:')){const now=new Date().toISOString();const localFile=String(input.localFileName||String(input._id).slice(6));const title0=String(input.title||path.parse(localFile).name).trim()||path.parse(localFile).name;const r=database().prepare(`INSERT INTO games(title,console,icon,original_name,source,game_id,cover_installed,download_url,downloads_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(title0,String(input.console||'PS2'),input.icon||null,localFile,String(input.source||'local'),input.gameId||null,input.coverInstalled?1:0,null,'[]',now,now);id=Number(r.lastInsertRowid)}else throw new Error('ID do jogo inválido.');}const title=String(input.title||'').trim();if(!title)throw new Error('Informe o título.');const icon=String(input.icon||'').trim()||null;if(icon){const u=new URL(icon);if(!['http:','https:'].includes(u.protocol))throw new Error('URL da capa inválida.')}const normalized=(Array.isArray(input.downloads)?input.downloads:[]).filter((x:any)=>String(x?.url||'').trim()).map((x:any,i:number)=>{const u=new URL(String(x.url));if(!['http:','https:'].includes(u.protocol))throw new Error(`URL inválida na opção ${i+1}.`);return{name:String(x.name||`Opção ${i+1}`),url:u.toString(),region:String(x.region||''),format:String(x.format||''),size:String(x.size||''),source:String(x.source||'manual'),originalName:safeName(String(x.originalName||''))}});database().prepare(`UPDATE games SET title=?,console=?,icon=?,original_name=?,source=?,game_id=?,download_url=?,downloads_json=?,updated_at=? WHERE id=?`).run(title,String(input.console||'PS2'),icon,String(input.originalName||''),String(input.source||'manual'),String(input.gameId||'').trim().toUpperCase()||null,normalized[0]?.url||null,JSON.stringify(normalized),new Date().toISOString(),id);return rowToGame(database().prepare('SELECT * FROM games WHERE id=?').get(id))});
handle('games:stats',async()=>({total:Number((database().prepare(`SELECT COUNT(*) AS n FROM games WHERE console='PS2'`).get() as any).n||0),downloaded:fs.readdirSync(dvdDir()).filter(x=>x.toLowerCase()!=='games.bin'&&/\.(iso|bin|zip|7z)$/i.test(x)).length}));
handle('download:list',()=>Array.from(downloads.values()));
handle('games:installed',async()=>{const rows=database().prepare(`SELECT * FROM games WHERE console='PS2'`).all() as any[],docs=rows.map(rowToGame),files=fs.readdirSync(dvdDir()).filter(x=>x.toLowerCase()!=='games.bin'&&/\.(iso|bin)$/i.test(x)),byName=new Map<string,any>();for(const g of docs){if(g.originalName)byName.set(safeName(String(g.originalName)).toLowerCase(),g);for(const o of downloadOptions(g))byName.set(fileNameForDownload(g,o).toLowerCase(),g)}const result=[];for(const fileName of files){const full=path.join(dvdDir(),fileName),g=byName.get(fileName.toLowerCase());let id=g?.gameId||null;if(!id){try{id=extractGameId(full)}catch{}}let coverInstalled=!!id&&fs.existsSync(path.join(artDir(),`${id}_COV.jpg`));if(g&&id&&(!coverInstalled||g.gameId!==id)){coverInstalled=(await installCover(g.icon,id))||coverInstalled;database().prepare('UPDATE games SET game_id=?,cover_installed=?,updated_at=? WHERE id=?').run(id,coverInstalled?1:0,new Date().toISOString(),Number(g._id))}result.push({...g,_id:g?g._id:`local:${fileName}`,title:g?.title||path.parse(fileName).name,console:'PS2',localFileName:fileName,downloaded:true,gameId:id,coverInstalled,localPath:full,ra:await compatibility.check(full),size:fs.statSync(full).size})}return result.sort((a,b)=>String(a.title).localeCompare(String(b.title)))});
handle('covers:repair',async()=>{const installed:any[]=await (async()=>{const files=fs.readdirSync(dvdDir()).filter(x=>x.toLowerCase()!=='games.bin'&&/\.(iso|bin)$/i.test(x));return files})();let repaired=0,missingId=0,missingCover=0;const docs=(database().prepare(`SELECT * FROM games WHERE console='PS2'`).all() as any[]).map(rowToGame);const byName=new Map<string,any>();for(const g of docs){if(g.originalName)byName.set(safeName(String(g.originalName)).toLowerCase(),g);for(const o of downloadOptions(g))byName.set(fileNameForDownload(g,o).toLowerCase(),g)}for(const fileName of installed){const g=byName.get(String(fileName).toLowerCase());if(!g){missingCover++;continue}let id=g.gameId||null;if(!id){try{id=extractGameId(path.join(dvdDir(),fileName))}catch{}}if(!id){missingId++;continue}const ok=await installCover(g.icon,id);ok?repaired++:missingCover++;database().prepare('UPDATE games SET game_id=?,cover_installed=?,updated_at=? WHERE id=?').run(id,ok?1:0,new Date().toISOString(),Number(g._id))}return{repaired,missingId,missingCover,total:installed.length}});
handle('download:start',async(event,g:any,choice:any=null)=>{const options=downloadOptions(g),selected=choice?.url?choice:options[0];if(!selected?.url)throw new Error('Jogo sem opção de download cadastrada');const url=new URL(selected.url);if(!['http:','https:'].includes(url.protocol))throw new Error('URL inválida');const key=gameKey(g),fn=fileNameForDownload(g,selected),save=path.join(dvdDir(),fn);if(fs.existsSync(save))return{success:true,alreadyDownloaded:true,gameKey:key,fileName:fn};const old=downloads.get(key);if(old&&['starting','progressing','processing'].includes(old.state))return old;const st:DownloadState={gameKey:key,fileName:fn,url:url.toString(),path:save,icon:g.icon||null,state:'starting',received:0,total:0,percent:0};downloads.set(key,st);event.sender.downloadURL(url.toString());broadcast('download:progress',st);return st});
handle('game:delete',async(_e,g:any)=>{const key=gameKey(g),opts=downloadOptions(g),st=downloads.get(key);if(st&&['starting','progressing','processing'].includes(st.state))throw new Error('Aguarde o download terminar antes de excluir.');for(const name of [g.localFileName,g.originalName].filter(Boolean)){const p=path.join(dvdDir(),safeName(String(name)));if(fs.existsSync(p))fs.rmSync(p,{force:true})}for(const o of opts){const p=path.join(dvdDir(),fileNameForDownload(g,o));if(fs.existsSync(p))fs.rmSync(p,{force:true})}const id=g.gameId||st?.gameId||null;if(id)for(const suffix of ['_COV.jpg','_COV.png','_BG.jpg','_BG.png']){const p=path.join(artDir(),`${id}${suffix}`);if(fs.existsSync(p))fs.rmSync(p,{force:true})}downloads.delete(key);if(Number.isSafeInteger(Number(key))&&Number(key)>0)deleteCatalogGame(database(),Number(key));return{success:true}});
handle('opl:status',()=>oplStatus());

function configureDownloads(){session.defaultSession.on('will-download',(event,item)=>{const url=item.getURL(),chain=item.getURLChain?.()||[];let current=Array.from(downloads.values()).find(d=>['starting','progressing'].includes(d.state)&&(d.url===url||chain.includes(d.url)));if(!current){const pending=Array.from(downloads.values()).filter(d=>['starting','progressing'].includes(d.state));if(pending.length===1)current=pending[0]}if(!current){event.preventDefault();return}const key=current.gameKey;fs.mkdirSync(path.dirname(current.path),{recursive:true});item.setSavePath(current.path);const pub=()=>{const total=item.getTotalBytes(),received=item.getReceivedBytes();const next:DownloadState={...current!,state:'progressing',received,total,percent:total>0?Math.round(received/total*100):0};current=next;downloads.set(key,next);broadcast('download:progress',next)};item.on('updated',(_x,state)=>{if(state==='progressing')pub()});item.once('done',(_x,state)=>{const old=downloads.get(key)!;if(state==='completed'){const processing:DownloadState={...old,state:'processing',received:item.getReceivedBytes(),total:item.getTotalBytes(),percent:100};downloads.set(key,processing);broadcast('download:progress',processing);void finishGame(processing)}else{const failed:DownloadState={...old,state:state as DownloadState['state'],error:`Download ${state}`};downloads.set(key,failed);broadcast('download:error',failed)}})})}


// ============================================================
// SPLASH / NOW PLAYING (isolated from catalog/database flow)
// ============================================================
let splashWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;
let nowPlayingTimer: NodeJS.Timeout | null = null;
let nowPlayingState: any = null;

function splashAssetPath(): string {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'ps2-splash.png'),
        path.join(process.resourcesPath, 'assets', 'ps2-splash.png'),
        path.join(process.resourcesPath, 'app.asar', 'dist', 'ps2-splash.png')
      ]
    : [
        path.join(__dirname, '..', 'assets-ps2-splash.png'),
        path.join(__dirname, '..', 'public', 'ps2-splash.png'),
        path.join(process.cwd(), 'assets', 'ps2-splash.png')
      ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

async function createSplash(): Promise<BrowserWindow> {
  const splash = new BrowserWindow({
    width: 760,
    height: 430,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    show: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  const imageUrl = `data:image/png;base64,${fs.readFileSync(splashAssetPath()).toString('base64')}`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
body{font-family:Inter,Segoe UI,Arial,sans-serif}
.stage{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000}
.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.overlay{position:absolute;inset:0;background:linear-gradient(transparent 62%,rgba(0,0,0,.72))}
.status{position:absolute;bottom:26px;left:32px;right:32px;color:#fff;text-align:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase}
.track{width:220px;height:3px;margin:12px auto 0;background:rgba(255,255,255,.18);overflow:hidden;border-radius:99px}
.fill{height:100%;width:38%;background:#fff;animation:slide 1s ease-in-out infinite}
@keyframes slide{0%{transform:translateX(-110%)}100%{transform:translateX(300%)}}
</style></head><body><div class="stage">
<img src="${imageUrl}" />
<div class="overlay"></div>
<div class="status">Carregando Caduceus<div class="track"><div class="fill"></div></div></div>
</div></body></html>`;
  await splash.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));
  splash.show();
  return splash;
}

function runtimePs2Roots(): string[] {return [shareDir()]}

function parseGameIdentity(fileName: string) {
  const base = fileName.replace(/\.(iso|zso|bin)$/i, '');
  const m = base.match(/([A-Z]{4}[_-]\d{3}\.\d{2})/i);
  const gameId = m ? m[1].toUpperCase().replace('-', '_') : null;
  const title = base
    .replace(/^[A-Z]{4}[_-]\d{3}\.\d{2}[.\s_-]*/i, '')
    .replace(/[._]+/g, ' ')
    .trim() || base;
  return { gameId, title };
}

async function resolveCatalogGame(gameId: string | null, fileName: string, fallbackTitle: string) {
  try {
    // Uses the same SQLite accessor already used by the application.
    const db: any = typeof database === 'function' ? database() : null;
    if (!db) return { title: fallbackTitle, gameId, icon: null };
    let row: any = null;
    if (gameId) {
      row = db.prepare(`
        SELECT id,title,icon,game_id
        FROM games
        WHERE UPPER(REPLACE(COALESCE(game_id,''),'-','_')) = ?
        LIMIT 1
      `).get(gameId);
    }
    if (!row) {
      const clean = fallbackTitle.toLowerCase();
      const rows: any[] = db.prepare(`SELECT id,title,icon,game_id,original_name FROM games`).all();
      row = rows.find((r:any) =>
        (r.original_name && fileName.toLowerCase().includes(String(r.original_name).toLowerCase())) ||
        String(r.title || '').toLowerCase() === clean
      );
    }
    return row ? { id: row.id, title: row.title, gameId: row.game_id || gameId, icon: row.icon || null } :
                 { title: fallbackTitle, gameId, icon: null };
  } catch {
    return { title: fallbackTitle, gameId, icon: null };
  }
}

const oplActivity = new OplActivityMonitor(
  app.isPackaged
    ? path.join(process.resourcesPath, 'opl-activity', 'opl-activity.ps1')
    : path.join(__dirname, '..', 'electron', 'native', 'opl-activity.ps1'),
  () => oplPort()
);

async function detectActiveGame() {
  const roots = runtimePs2Roots().flatMap(root => ['DVD', 'CD'].map(sub => path.resolve(root, sub).toLowerCase() + path.sep));
  const files = oplActivity.read().filter(file => {
    const full = path.resolve(file).toLowerCase();
    return roots.some(root => full.startsWith(root)) && /\.(iso|zso|bin)$/i.test(file);
  });
  // Ambiguous activity is not enough to identify a game.
  if (files.length !== 1) return null;
  const full = files[0];
  const best = { fileName: path.basename(full), full, size: fs.statSync(full).size };

  const ident = parseGameIdentity(best.fileName);
  const catalog = await resolveCatalogGame(ident.gameId, best.fileName, ident.title);
  return {
    ...catalog,
    fileName: best.fileName,
    filePath: best.full,
    size: best.size,
    active: true,
    detectedAt: new Date().toISOString()
  };
}

function startNowPlayingMonitor() {
  if (nowPlayingTimer) clearInterval(nowPlayingTimer);
  let checking = false;

  const tick = async () => {
    if (checking || storageChanging) return;
    checking = true;
    try {
      const smb = await detectActiveGame();
      const engine = xera.status();
      const telemetry = engine.connected && engine.game
        ? {...await resolveCatalogGame(null, '', engine.game), active:true, detectedAt:new Date().toISOString(), fileName:'', filePath:''}
        : null;
      const detected = playSession.resolve(smb, telemetry);
      nowPlayingState = detected;
      discord.updateSMB(detected?.title||null,detected?.icon);
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('now-playing:changed', nowPlayingState);
      }
    } catch (e) {
      console.error('[now-playing]', e);
      nowPlayingState = null;
      discord.updateSMB(null);
      broadcast('now-playing:changed', null);
    } finally {
      checking = false;
    }
  };

  tick();
  nowPlayingTimer = setInterval(tick, 2500);
}

handle('now-playing:get', async () => nowPlayingState);

async function stopManagedOpl() {
  const child = oplProcess;
  if (!child) {
    if (await portOnline()) throw new Error('Feche o OPLServer aberto fora deste aplicativo antes de alterar a pasta.');
    return;
  }
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {child.removeListener('exit', done); reject(new Error('Não foi possível parar o OPL Server.'));}, 6000);
      const done = () => {clearTimeout(timer); resolve()};
      child.once('exit', done);
      if (!child.kill()) {clearTimeout(timer);child.removeListener('exit', done);reject(new Error('Não foi possível encerrar o OPL Server.'));}
    });
  }
  if (oplProcess === child) oplProcess = null;
  if (await portOnline()) throw new Error('A porta do OPL ainda está ocupada. Feche outras instâncias do servidor.');
}

ipcMain.handle('storage:get', async () => ({...await storage().describe(), busy:storageChanging}));
ipcMain.handle('network:get', async () => ({...await oplStatus(),addresses:localAddresses()}));
ipcMain.handle('network:set-port', async (_event, port:unknown) => {
  validatePort(port);
  if (storageChanging || serverStarting || trackedRequests || Array.from(downloads.values()).some(item => ['starting','progressing','processing'].includes(item.state))) throw new Error('Aguarde as operações em andamento antes de alterar a porta.');
  const previous = oplPort();
  if (port === previous) return {...await oplStatus(),addresses:localAddresses()};
  if (nowPlayingState || oplActivity.read().length) throw new Error('Encerre o jogo no PS2 antes de alterar a porta.');
  storageChanging = true;
  let stopped = false;
  try {
    await assertPortAvailable(port);
    await stopManagedOpl();
    stopped = true;
    oplActivity.stop();nowPlayingState=null;broadcast('now-playing:changed',null);
    storage().setPort(port);
    await startOpl();
    if (!await portOnline()) throw new Error('O OPL Server não iniciou na nova porta.');
    return {...await oplStatus(),online:true,addresses:localAddresses()};
  } catch (error) {
    if (stopped) {
      try {await stopManagedOpl();storage().setPort(previous);await startOpl()}
      catch (restoreError) {throw new Error(`Não foi possível aplicar a porta nem restaurar o servidor: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`)}
    }
    throw error;
  } finally {
    storageChanging = false;
    void publishOpl().catch(error => console.error('OPL status:',error));
  }
});
ipcMain.handle('storage:select', async () => {
  if (storageChanging) throw new Error('Aguarde a transferência terminar.');
  const result = await dialog.showOpenDialog({title:'Escolha onde criar a pasta oplserver',properties:['openDirectory','createDirectory']});
  if (result.canceled || !result.filePaths[0]) return null;
  const target = storage().validateTarget(path.join(result.filePaths[0], 'oplserver'));
  selectedStorageTarget = target;
  return target;
});
ipcMain.handle('storage:change', async (_event, input:{directory:string; mode:StorageMode}) => {
  if (!input || input.directory !== selectedStorageTarget || !['move','fresh'].includes(input.mode)) throw new Error('Selecione novamente o destino nas configurações.');
  const assertIdle = () => {
    if (storageChanging || serverStarting || trackedRequests || Array.from(downloads.values()).some(item => ['starting','progressing','processing'].includes(item.state))) throw new Error('Aguarde os downloads, importações e outras operações terminarem antes de alterar a pasta.');
    if (nowPlayingState || oplActivity.read().length) throw new Error('Encerre o jogo no PS2 antes de alterar a pasta do servidor.');
  };
  assertIdle();
  storage().validateTarget(input.directory);
  const source = runtimeOplDir();
  if (input.mode === 'fresh' && fs.existsSync(source)) {
    const confirmation = await dialog.showMessageBox({type:'warning',title:'Excluir a pasta antiga do OPL Server?',
      message:'Todos os arquivos da pasta antiga serão excluídos permanentemente.',
      detail:`Isso inclui ISOs, capas, configurações e cartões de memória (VMC). O catálogo de jogos será mantido.\n\nPasta a excluir:\n${source}\n\nNova pasta:\n${input.directory}`,
      buttons:['Cancelar','Excluir a antiga e criar uma nova'],defaultId:0,cancelId:0,noLink:true});
    if (confirmation.response !== 1) return {cancelled:true};
  }
  assertIdle();
  storageChanging = true;
  let stopped = false;
  let lastProgress = 0;
  try {
    broadcast('storage:progress',{phase:'stopping',received:0,total:0});
    await stopManagedOpl();
    stopped = true;
    oplActivity.stop(); nowPlayingState=null; broadcast('now-playing:changed',null);
    const result = await storage().change(input.directory,input.mode,async () => {
      await startOpl();
      if (!await portOnline()) throw new Error('O servidor não iniciou no novo local.');
    }, progress => {
      if (progress.phase !== 'copying' || Date.now()-lastProgress>150) {lastProgress=Date.now();broadcast('storage:progress',progress);}
    });
    downloads.clear();
    if (input.mode === 'fresh') database().exec('UPDATE games SET cover_installed=0');
    selectedStorageTarget = null;
    broadcast('storage:progress',{phase:'done',received:1,total:1});
    return {...result,cancelled:false};
  } catch (error) {
    if (stopped) {
      try {await stopManagedOpl();await startOpl()} catch (restartError) {console.error('OPL restart:',restartError);}
    }
    throw error;
  } finally {
    storageChanging = false;
    void publishOpl().catch(error => console.error('OPL status:',error));
  }
});

async function createWindow(){
  splashWindow = await createSplash();
  const splashStarted = Date.now();
  try {
    const w = new BrowserWindow({width:1500,height:920,minWidth:1050,minHeight:700,show:false,backgroundColor:'#09090b',icon:app.isPackaged?path.join(process.resourcesPath,'icon.png'):path.join(process.cwd(),'build','icon.png'),webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
    mainWindowRef = w;
    w.on('close', event => {if(storageChanging)event.preventDefault()});
    if(!app.isPackaged) await w.loadURL('http://localhost:5173');
    else await w.loadFile(path.join(__dirname,'../dist/index.html'));
    const remaining = Math.max(0, 3000 - (Date.now() - splashStarted));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
    w.show();
    w.focus();
    startNowPlayingMonitor();
  } finally {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
  }
}
app.whenReady().then(async()=>{database();ensureRuntime();if(achievements.status().user)void xera.start().catch(e=>broadcast('xera:status',{running:false,connected:false,user:'',game:'',error:e instanceof Error?e.message:String(e)}));discord.start();void discordAuth.restore().then(()=>{discord.setAccount(discordAuth.user()?.id||null);discord.configure({enabled:discord.status().enabled,clientId:DISCORD_CLIENT_ID});broadcast('discord:status',discordStatus())}).catch(()=>{discord.setAccount(null);broadcast('discord:status',discordStatus())});configureDownloads();await createWindow();try{await startOpl()}catch(e){broadcast('opl:error',{message:e instanceof Error?e.message:String(e)})}setInterval(()=>{void publishOpl()},1500).unref()}).catch(e=>{console.error(e);app.quit()});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow()});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('before-quit',(event)=>{if(storageChanging){event.preventDefault();return;}discordAuth.cancel();discord.stop();if(nowPlayingTimer)clearInterval(nowPlayingTimer);oplActivity.stop();if(oplProcess&&!oplProcess.killed)oplProcess.kill();try{db?.close()}catch{}});
