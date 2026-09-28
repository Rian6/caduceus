import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { DatabaseSync } from 'node:sqlite';

const MONGO_URI=process.env.MONGO_URI||'mongodb://localhost:27017';
const MONGO_DATABASE=process.env.MONGO_DATABASE||'romsfun';
const MONGO_COLLECTION=process.env.MONGO_COLLECTION||'jogos';
const OUT=path.resolve('database','catalog.sqlite3');

function plain(v){
  if(v==null)return v;
  if(v instanceof Date)return v.toISOString();
  if(Array.isArray(v))return v.map(plain);
  if(typeof v==='object'){
    if(v._bsontype==='ObjectId'||v.constructor?.name==='ObjectId')return String(v);
    const o={}; for(const [k,x] of Object.entries(v))o[k]=plain(x); return o;
  }
  return v;
}
function downloadsOf(d){
  if(Array.isArray(d.downloads))return plain(d.downloads);
  if(d.downloadUrl)return [{name:'Download',url:String(d.downloadUrl),region:'',format:'',size:d.size||'',source:d.source||'',originalName:d.originalName||''}];
  return [];
}

console.log(`Conectando em ${MONGO_URI} -> ${MONGO_DATABASE}.${MONGO_COLLECTION}`);
const client=new MongoClient(MONGO_URI,{serverSelectionTimeoutMS:5000});
await client.connect();
try{
  const docs=await client.db(MONGO_DATABASE).collection(MONGO_COLLECTION).find({}).toArray();
  console.log(`MongoDB: ${docs.length} documentos`);
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  for(const f of [OUT,OUT+'-wal',OUT+'-shm'])if(fs.existsSync(f))fs.rmSync(f,{force:true});
  const db=new DatabaseSync(OUT);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE games(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mongo_id TEXT UNIQUE,
    title TEXT NOT NULL,
    console TEXT NOT NULL DEFAULT 'PS2',
    icon TEXT, original_name TEXT, source TEXT, source_page TEXT,
    game_id TEXT, cover_installed INTEGER NOT NULL DEFAULT 0,
    download_url TEXT, downloads_json TEXT NOT NULL DEFAULT '[]',
    size TEXT, raw_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX ux_games_title_console ON games(title COLLATE NOCASE,console);
  CREATE INDEX ix_games_title ON games(title COLLATE NOCASE);`);
  const ins=db.prepare(`INSERT OR REPLACE INTO games(mongo_id,title,console,icon,original_name,source,source_page,game_id,cover_installed,download_url,downloads_json,size,raw_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  let inserted=0, skipped=0;
  try{
    for(const raw of docs){
      const d=plain(raw); const title=String(d.title||'').trim(); if(!title){skipped++;continue}
      const ds=downloadsOf(d); const now=new Date().toISOString();
      ins.run(String(d._id||''),title,String(d.console||'PS2'),d.icon||null,d.originalName||d.original_name||null,d.source||null,d.sourcePage||d.url||null,d.gameId||d.game_id||null,d.coverInstalled?1:0,d.downloadUrl||ds[0]?.url||null,JSON.stringify(ds),d.size||null,JSON.stringify(d),d.createdAt||now,d.updatedAt||now); inserted++;
    }
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const count=Number(db.prepare('SELECT COUNT(*) n FROM games').get().n);
  db.close();
  console.log(`SQLite: ${count} jogos (${skipped} ignorados sem título)`);
  console.log(`Gerado: ${OUT}`);
  if(count!==inserted)console.warn(`Aviso: ${inserted} documentos válidos processados e ${count} linhas finais (títulos duplicados podem ter sido consolidados).`);
} finally { await client.close(); }
