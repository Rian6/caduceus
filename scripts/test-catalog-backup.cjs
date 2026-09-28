const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {saveCatalogBackup}=require('../dist-electron/catalog-backup.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-backup-'));
const current=path.join(root,'current.sqlite3'),destination=path.join(root,'backup.sqlite3');
const db=new DatabaseSync(current);
try {
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE games(id INTEGER PRIMARY KEY,title TEXT); INSERT INTO games VALUES(1,'Backup test')");
  saveCatalogBackup(db,current,destination);
  let copy=new DatabaseSync(destination,{readOnly:true});
  assert.equal(copy.prepare('SELECT title FROM games').get().title,'Backup test');copy.close();
  db.exec("INSERT INTO games VALUES(2,'New game')");
  saveCatalogBackup(db,current,destination);
  copy=new DatabaseSync(destination,{readOnly:true});
  assert.equal(copy.prepare('SELECT count(*) AS n FROM games').get().n,2);copy.close();
  assert.throws(()=>saveCatalogBackup(db,current,current),/base em uso/);
  assert.throws(()=>saveCatalogBackup(db,current,current+'-wal'),/base em uso/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM games').get().n,2);
  assert(!fs.readdirSync(root).some(name=>name.startsWith('.catalog-backup-')));
  console.log('PASS: WAL snapshot, existing backup replacement, live database protection and temporary file cleanup.');
} finally {db.close();fs.rmSync(root,{recursive:true,force:true})}
