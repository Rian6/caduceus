const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {deleteCatalogGame}=require('../dist-electron/catalog-delete');
const db=new DatabaseSync(':memory:');
try{
  db.exec("CREATE TABLE games(id INTEGER PRIMARY KEY,title TEXT,console TEXT); INSERT INTO games VALUES(1,'Example','PS2'),(2,'Keep me','PS2')");
  assert.equal(Number(deleteCatalogGame(db,1)),1);
  assert.equal(db.prepare('SELECT * FROM games WHERE id=1').get(),undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM games').get().n,1);
  assert(db.prepare('SELECT 1 FROM deleted_seed_games WHERE title=? AND console=?').get('EXAMPLE','PS2'),'seed synchronization must skip deleted titles');
  assert.equal(Number(deleteCatalogGame(db,1)),0,'repeating deletion is safe');
  db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON games BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  assert.throws(()=>deleteCatalogGame(db,2));
  assert(db.prepare('SELECT 1 FROM games WHERE id=2').get());
  assert.equal(db.prepare('SELECT 1 FROM deleted_seed_games WHERE title=?').get('Keep me'),undefined,'failed transaction must not leave an exclusion marker');
  console.log('PASS: SQLite deletion, unrelated records, seed exclusion, repeat deletion and rollback.');
}finally{db.close()}
