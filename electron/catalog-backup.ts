import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export function saveCatalogBackup(db:DatabaseSync, currentFile:string, destination:string) {
  const canonical = (file:string) => (fs.existsSync(file) ? fs.realpathSync.native(file) : path.resolve(file)).toLowerCase();
  const current = canonical(currentFile), target = canonical(destination);
  if ([current,current+'-wal',current+'-shm',current+'-journal'].includes(target)) throw new Error('Escolha outro arquivo: a base em uso não pode ser substituída pelo backup.');
  if (fs.existsSync(destination) && fs.existsSync(currentFile)) {
    const sourceStat = fs.statSync(currentFile), targetStat = fs.statSync(destination);
    if (sourceStat.dev === targetStat.dev && sourceStat.ino === targetStat.ino) throw new Error('Escolha um arquivo diferente da base em uso.');
  }
  const temporary = path.join(path.dirname(destination), `.catalog-backup-${randomUUID()}.sqlite3`);
  try {
    // A SQLite snapshot includes committed WAL data while the app stays open.
    db.prepare('VACUUM INTO ?').run(temporary);
    fs.renameSync(temporary, destination);
  } finally {if (fs.existsSync(temporary)) fs.unlinkSync(temporary)}
  return destination;
}
