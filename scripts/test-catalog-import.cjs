const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {importCatalog} = require('../dist-electron/catalog-import.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'catalog-import-'));
const db = new DatabaseSync(':memory:');
try {
  db.exec(`CREATE TABLE games(id INTEGER PRIMARY KEY,mongo_id TEXT UNIQUE,title TEXT,console TEXT,icon TEXT,original_name TEXT,source TEXT,game_id TEXT,download_url TEXT,downloads_json TEXT,created_at TEXT,updated_at TEXT)`);
  const json = path.join(root,'games.json');
  fs.writeFileSync(json,JSON.stringify([{title:'Test Game',downloadUrl:'https://example.com/game.iso'}]));
  const first = importCatalog(db,json,path.join(root,'backups'));
  assert.equal(first.added,1);
  const backup = new DatabaseSync(first.backup,{readOnly:true});
  assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM games').get().n,0);
  backup.close();
  assert.equal(importCatalog(db,json,path.join(root,'backups')).skipped,1);
  fs.writeFileSync(json,JSON.stringify([{title:'Should not be added'},{title:'Bad URL',icon:'file:///secret'}]));
  assert.throws(()=>importCatalog(db,json,path.join(root,'backups')),/HTTP/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n,1);
  const sqlite = path.join(root,'source.sqlite3');
  const source = new DatabaseSync(sqlite);
  source.exec("CREATE TABLE games(title TEXT, downloads_json TEXT); INSERT INTO games VALUES('SQLite Game','[]')");
  source.close();
  assert.equal(importCatalog(db,sqlite,path.join(root,'backups')).added,1);
  // A late insertion failure rolls back all preceding rows in that import.
  db.exec("CREATE TRIGGER reject_game BEFORE INSERT ON games WHEN NEW.title='Reject' BEGIN SELECT RAISE(ABORT,'test failure'); END");
  fs.writeFileSync(json,JSON.stringify([{title:'Rollback Game'},{title:'Reject'}]));
  assert.throws(()=>importCatalog(db,json,path.join(root,'backups')),/test failure/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n,2);
  console.log('PASS: JSON, SQLite, duplicate detection, backup, invalid data and atomic rollback.');
} finally {db.close();fs.rmSync(root,{recursive:true,force:true})}
