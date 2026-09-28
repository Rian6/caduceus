import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const p=path.resolve('database','catalog.sqlite3');
if(!fs.existsSync(p)){console.error('catalog.sqlite3 não existe. Rode npm run migrate:mongo');process.exit(1)}
const db=new DatabaseSync(p,{readOnly:true});
const one=q=>Number(db.prepare(q).get().n||0);
console.log('Catálogo SQLite');
console.log('  jogos:',one('SELECT COUNT(*) n FROM games'));
console.log('  com capa:',one("SELECT COUNT(*) n FROM games WHERE icon IS NOT NULL AND icon<>''"));
console.log('  com download:',one("SELECT COUNT(*) n FROM games WHERE (download_url IS NOT NULL AND download_url<>'') OR downloads_json<>'[]'"));
console.log('  com raw_json:',one("SELECT COUNT(*) n FROM games WHERE raw_json IS NOT NULL AND raw_json<>''"));
db.close();
