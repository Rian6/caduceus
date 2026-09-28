import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export function importCatalog(target:DatabaseSync, file:string, backupDirectory:string) {
  if (fs.statSync(file).size > 100 * 1024 * 1024) throw new Error('A base deve ter no máximo 100 MB.');
  let rows:any[];
  if (path.extname(file).toLowerCase() === '.json') {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    rows = Array.isArray(parsed) ? parsed : parsed.games;
  } else {
    const source = new DatabaseSync(file, {readOnly:true});
    try {rows = source.prepare('SELECT * FROM games LIMIT 100001').all()} finally {source.close()}
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 100000) throw new Error('A base deve conter entre 1 e 100.000 jogos. JSON: use uma lista de jogos ou {"games": [...]}.');
  const text = (value:unknown):string|null => typeof value === 'string' && value.trim() ? value.trim() : null;
  const url = (value:unknown) => {
    const result = text(value);
    if (!result) return null;
    if (!/^https?:\/\//i.test(result)) throw new Error('As URLs de capas e downloads devem usar HTTP ou HTTPS.');
    new URL(result);
    return result;
  };
  const games = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || !text(row.title)) throw new Error(`Jogo ${index + 1}: título ausente.`);
    const consoleName = text(row.console) || 'PS2';
    if (consoleName.toUpperCase() !== 'PS2') throw new Error(`Jogo ${index + 1}: apenas catálogos PS2 são aceitos.`);
    const downloads = row.downloads ?? JSON.parse(row.downloads_json || '[]');
    if (!Array.isArray(downloads)) throw new Error(`Jogo ${index + 1}: lista de downloads inválida.`);
    const normalized = downloads.map((item:any) => {
      if (!item || !url(item.url)) throw new Error(`Jogo ${index + 1}: download sem URL.`);
      return {...item, url:url(item.url)};
    });
    return {title:text(row.title)!, mongo:text(row.mongo_id) || text(row._id?.$oid) || text(row._id),
      icon:url(row.icon), original:text(row.originalName ?? row.original_name), source:text(row.source),
      gameId:text(row.gameId ?? row.game_id), download:url(row.downloadUrl ?? row.download_url) || normalized[0]?.url || null,
      downloads:JSON.stringify(normalized)};
  });
  fs.mkdirSync(backupDirectory, {recursive:true});
  const backup = path.join(backupDirectory, `catalog-before-import-${randomUUID()}.sqlite3`);
  target.prepare('VACUUM INTO ?').run(backup);
  const existing = target.prepare('SELECT id FROM games WHERE (title=? COLLATE NOCASE AND console=?) OR (mongo_id IS NOT NULL AND mongo_id=?) LIMIT 1');
  const insert = target.prepare('INSERT INTO games (mongo_id,title,console,icon,original_name,source,game_id,download_url,downloads_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  let added = 0, skipped = 0;
  target.exec('BEGIN IMMEDIATE');
  try {
    for (const game of games) {
      if (existing.get(game.title, 'PS2', game.mongo)) {skipped++;continue}
      const now = new Date().toISOString();
      insert.run(game.mongo,game.title,'PS2',game.icon,game.original,game.source,game.gameId,game.download,game.downloads,now,now);
      added++;
    }
    target.exec('COMMIT');
  } catch(error) {target.exec('ROLLBACK');throw error}
  return {cancelled:false,added,skipped,backup};
}
