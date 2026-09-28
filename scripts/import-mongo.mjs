import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { DatabaseSync } from 'node:sqlite';

// Import into the existing catalog without replacing IDs or deleting local games.
const target = path.resolve('database', 'catalog.sqlite3');
const databaseName = process.env.MONGO_DATABASE || 'romsfun';
const collectionName = process.env.MONGO_COLLECTION || 'jogos';
const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017', {serverSelectionTimeoutMS:5000});
let db;

try {
  await client.connect();
  const documents = await client.db(databaseName).collection(collectionName).find({}).toArray();
  if (!documents.length) throw new Error('MongoDB collection is empty; local catalog was not changed.');
  if (!fs.existsSync(target)) throw new Error('Local catalog does not exist. Run migrate:mongo for the initial migration.');

  db = new DatabaseSync(target);
  db.exec('PRAGMA busy_timeout=10000');
  const backupDirectory = path.join(path.dirname(target), 'backups');
  fs.mkdirSync(backupDirectory, {recursive:true});
  const backup = path.join(backupDirectory, `catalog-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite3`);
  // SQLite creates a consistent snapshot, including committed WAL contents.
  db.prepare('VACUUM INTO ?').run(backup);
  console.log(`Backup: ${backup}`);

  const byMongo = db.prepare('SELECT * FROM games WHERE mongo_id=?');
  const byTitle = db.prepare('SELECT * FROM games WHERE title=? COLLATE NOCASE AND console=?');
  const columns = ['mongo_id','title','console','icon','original_name','source','source_page','game_id','cover_installed','download_url','downloads_json','size','raw_json','created_at','updated_at'];
  const insert = db.prepare(`INSERT INTO games (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
  const update = db.prepare(`UPDATE games SET ${columns.map(column => `${column}=?`).join(',')} WHERE id=?`);
  let added = 0, updated = 0, skipped = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const raw of documents) {
      const doc = JSON.parse(JSON.stringify(raw));
      const title = String(doc.title || '').trim();
      if (!title) {skipped++; continue;}
      const consoleName = String(doc.console || 'PS2');
      const mongoId = String(doc._id);
      const idMatch = byMongo.get(mongoId);
      const titleMatch = byTitle.get(title, consoleName);
      if (idMatch && titleMatch && idMatch.id !== titleMatch.id) {
        throw new Error(`Conflicting local records for ${title}; import rolled back.`);
      }
      const existing = idMatch || titleMatch;
      const downloads = Array.isArray(doc.downloads) ? doc.downloads : doc.downloadUrl ? [{
        name:'Download', url:String(doc.downloadUrl), region:'', format:'', size:doc.size || '',
        source:doc.source || '', originalName:doc.originalName || ''
      }] : [];
      const now = new Date().toISOString();
      const values = [
        mongoId, title, consoleName, doc.icon || existing?.icon || null,
        existing?.original_name || doc.originalName || doc.original_name || null,
        doc.source || existing?.source || null, doc.sourcePage || doc.url || existing?.source_page || null,
        existing?.game_id || doc.gameId || doc.game_id || null,
        existing?.cover_installed ?? 0,
        doc.downloadUrl || downloads[0]?.url || existing?.download_url || null,
        downloads.length ? JSON.stringify(downloads) : existing?.downloads_json || '[]',
        doc.size || existing?.size || null, JSON.stringify(doc),
        existing?.created_at || doc.createdAt || now, doc.updatedAt || now
      ];
      if (existing) {update.run(...values, existing.id); updated++;}
      else {insert.run(...values); added++;}
    }
    db.exec('COMMIT');
  } catch (error) {db.exec('ROLLBACK'); throw error;}
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  if (integrity !== 'ok') throw new Error(`SQLite integrity check: ${integrity}`);
  console.log(JSON.stringify({source:`${databaseName}.${collectionName}`, documents:documents.length, added, updated, skipped, total:db.prepare('SELECT COUNT(*) AS n FROM games').get().n, integrity}));
} finally {
  db?.close();
  await client.close();
}
