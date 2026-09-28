import html, json, sqlite3, string, time
from datetime import datetime, timezone
from pathlib import Path
import requests

API_URL='https://romsfun.com/api/search'
DB_PATH=Path('catalog.sqlite3')
CONSOLE='PS2'
DELAY=.25
s=requests.Session();s.headers.update({'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36','Referer':'https://romsfun.com/roms/playstation-2/'})

def schema(c):
 c.executescript('''CREATE TABLE IF NOT EXISTS games(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,console TEXT NOT NULL DEFAULT 'PS2',icon TEXT,original_name TEXT,source TEXT,source_page TEXT,game_id TEXT,cover_installed INTEGER NOT NULL DEFAULT 0,download_url TEXT,downloads_json TEXT NOT NULL DEFAULT '[]',size TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE UNIQUE INDEX IF NOT EXISTS ux_games_title_console ON games(title COLLATE NOCASE,console);CREATE INDEX IF NOT EXISTS ix_games_title ON games(title COLLATE NOCASE);''')

def main():
 con=sqlite3.connect(DB_PATH);schema(con);novos=0;atualizados=0
 for i,t in enumerate(string.ascii_lowercase+string.digits,1):
  print(f'[{i}/36] Buscando {t!r}...')
  try:r=s.get(API_URL,params={'s':t,'c':CONSOLE},timeout=20);r.raise_for_status();items=r.json()
  except Exception as e:print('  erro:',e);continue
  for x in items if isinstance(items,list) else []:
   title=html.unescape(str(x.get('title',''))).strip()
   if not title:continue
   now=datetime.now(timezone.utc).isoformat()
   old=con.execute('SELECT id FROM games WHERE title=? COLLATE NOCASE AND console=?',(title,CONSOLE)).fetchone()
   if old:
    con.execute('UPDATE games SET icon=COALESCE(?,icon),source_page=COALESCE(?,source_page),size=COALESCE(?,size),updated_at=? WHERE id=?',(x.get('icon'),x.get('url'),x.get('size'),now,old[0]));atualizados+=1
   else:
    con.execute('INSERT INTO games(title,console,icon,source,source_page,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',(title,CONSOLE,x.get('icon'),'romsfun',x.get('url'),x.get('size'),now,now));novos+=1
  con.commit();time.sleep(DELAY)
 print(f'Finalizado. Novos={novos} Atualizados={atualizados} Total={con.execute("SELECT COUNT(*) FROM games").fetchone()[0]} Banco={DB_PATH.resolve()}');con.close()
if __name__=='__main__':main()
