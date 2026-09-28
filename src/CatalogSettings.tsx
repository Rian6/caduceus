import {useState} from 'react';
import {Database, FolderOpen, Loader2, Download} from 'lucide-react';
import {errorText} from './ui';

export function CatalogSettings({locked,onBusy,onChanged}:{locked:boolean;onBusy:(busy:boolean)=>void;onChanged:()=>Promise<void>}) {
  const [busy,setBusy] = useState(false);
  const [saving,setSaving] = useState(false);
  const [backup,setBackup] = useState('');
  const [error,setError] = useState('');
  const [result,setResult] = useState<{added?:number;skipped?:number;backup?:string}|null>(null);
  return <fieldset className="settingsPanel settingsFieldset catalogPanel" disabled={locked||busy||saving}>
    <div className="settingsTitle"><span className="statIcon"><Database/></span><div><h2>Base de jogos</h2><p>Importe um catálogo PS2 em SQLite (.sqlite3, .sqlite, .db) ou JSON.</p></div></div>
    <p>Adiciona jogos novos e ignora os já cadastrados. Um backup da base atual é criado automaticamente. As ISOs não são importadas por esta opção.</p>
    <p className="storageNote">SQLite: base do aplicativo com a tabela games. JSON: lista de jogos com title e campos opcionais como icon, downloadUrl e downloads, ou um objeto com a propriedade games.</p>
    <button className="primary" onClick={async()=>{
      setBusy(true);onBusy(true);setError('');setResult(null);setBackup('');
      try {const imported=await window.games.importCatalog();if(!imported.cancelled){setResult(imported);await onChanged()}}
      catch(err){setError(errorText(err))}finally{setBusy(false);onBusy(false)}
    }}>{busy?<Loader2 className="spin"/>:<FolderOpen/>}{busy?'Importando base…':'Escolher base e importar'}</button>
    <div className="catalogBackup">
      <h3>Backup da base atual</h3>
      <p>Salve uma cópia completa do catálogo em SQLite. Você pode importar esse arquivo depois pela opção acima. ISOs e configurações do aplicativo não fazem parte do backup.</p>
      <button onClick={async()=>{
        setSaving(true);onBusy(true);setError('');setResult(null);setBackup('');
        try {const saved=await window.games.backupCatalog();if(!saved.cancelled)setBackup(saved.backup||'')}
        catch(err){setError(errorText(err))}finally{setSaving(false);onBusy(false)}
      }}>{saving?<Loader2 className="spin"/>:<Download/>}{saving?'Salvando backup…':'Salvar backup da base'}</button>
    </div>
    {backup&&<div className="formMsg ok" role="status"><p>Backup salvo com sucesso.</p><p><code>{backup}</code></p></div>}
    {error&&<p className="formMsg error" role="alert">{error}</p>}
    {result&&<div className="formMsg ok" role="status"><p>{result.added} jogos adicionados. {result.skipped} já cadastrados ignorados.</p><p>Backup: <code>{result.backup}</code></p></div>}
  </fieldset>;
}
