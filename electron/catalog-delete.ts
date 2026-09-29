import type {DatabaseSync} from 'node:sqlite';

export function prepareDeletedGames(db:DatabaseSync){
  db.exec('CREATE TABLE IF NOT EXISTS deleted_seed_games(title TEXT COLLATE NOCASE NOT NULL, console TEXT NOT NULL, PRIMARY KEY(title,console))');
}

export function deleteCatalogGame(db:DatabaseSync,id:number){
  prepareDeletedGames(db);
  db.exec('BEGIN');
  try{
    // Keep only an exclusion marker so bundled seed synchronization cannot
    // recreate a game explicitly removed by the user on the next startup.
    db.prepare('INSERT OR IGNORE INTO deleted_seed_games(title,console) SELECT title,console FROM games WHERE id=?').run(id);
    const result=db.prepare('DELETE FROM games WHERE id=?').run(id);
    db.exec('COMMIT');return result.changes;
  }catch(error){db.exec('ROLLBACK');throw error}
}
