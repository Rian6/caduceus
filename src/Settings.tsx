import {useEffect, useState} from 'react';
import {AlertTriangle, ArrowRight, CheckCircle2, FolderOpen, HardDrive, Loader2, MoveRight, RefreshCw, Trash2} from 'lucide-react';
import {bytes, errorText} from './ui';
import {NetworkSettingsPanel} from './NetworkSettings';
import {CatalogSettings} from './CatalogSettings';
import {AppearanceSettings} from './AppearanceSettings';
import {LibrarySettings} from './LibrarySettings';
import {DiscordSettings} from './DiscordSettings';

const phases:Record<string,string> = {stopping:'Parando o servidor SMB',copying:'Copiando arquivos…',verifying:'Verificando os arquivos copiados…',starting:'Iniciando o servidor no novo local…',removing:'Removendo a pasta antiga…',done:'Alteração concluída.'};

export function Settings({onChanged, onBusy, locked}: {onChanged:()=>Promise<void>; onBusy:(busy:boolean)=>void; locked:boolean}) {
  const [settings,setSettings] = useState<StorageSettings|null>(null);
  const [target,setTarget] = useState('');
  const [mode,setMode] = useState<'move'|'fresh'>('move');
  const [busy,setBusy] = useState(false);
  const [selecting,setSelecting] = useState(false);
  const [confirmed,setConfirmed] = useState(false);
  const [progress,setProgress] = useState<StorageProgress|null>(null);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [warning,setWarning] = useState('');
  const read = async () => {
    try {setSettings(await window.games.storageSettings());setError('')} catch(err) {setError(errorText(err))}
  };
  useEffect(() => {void read(); return window.games.onStorageProgress(setProgress);}, []);
  const percent = progress?.total ? Math.min(100,Math.round(progress.received*100/progress.total)) : 0;
  const destructive = mode === 'fresh' && settings?.exists;

  return <><NetworkSettingsPanel locked={locked} onBusy={onBusy} onChanged={onChanged}/><fieldset className="settingsPanel settingsFieldset" disabled={locked&&!busy}>
    <div className="settingsTitle"><span className="statIcon"><HardDrive/></span><div><h2>Armazenamento do OPL Server</h2><p>As ISOs ficam dentro da pasta do servidor, em PS2/DVD e PS2/CD.</p></div></div>
    {settings ? <>
      <div className="storageCurrent"><span className="eyebrow">LOCAL ATUAL</span><code>{settings.directory}</code><div className="storageFacts"><span><HardDrive/>{bytes(settings.bytes)}</span><span>{settings.isoCount} imagens de jogos</span></div><p>Pasta de ISOs: <code>{settings.isoDirectory}</code></p></div>
      <div className="storageDestination"><div><h3>Novo local</h3><p>Selecione a pasta que receberá a subpasta <b>oplserver</b>.</p></div><button disabled={busy||selecting||settings.busy} onClick={async()=>{
        setSelecting(true);setError('');setMessage('');setWarning('');
        try {const directory=await window.games.selectStorageDirectory();if(directory){setTarget(directory);setConfirmed(false);setProgress(null)}} catch(err){setError(errorText(err))} finally{setSelecting(false)}
      }}>{selecting?<Loader2 className="spin"/>:<FolderOpen/>}Escolher pasta</button></div>
      {target && <>
        <div className="storageTarget"><ArrowRight/><code>{target}</code></div>
        {settings.exists && <fieldset className="storageOptions" disabled={busy}>
          <legend>O que fazer com a pasta atual?</legend>
          <label className={mode==='move'?'chosen':''}><input type="radio" name="storageMode" value="move" checked={mode==='move'} onChange={()=>{setMode('move');setConfirmed(false)}}/><MoveRight/><span><b>Migrar a pasta inteira <small>Recomendado</small></b><p>Transfere ISOs, capas, configurações, VMCs e todos os outros arquivos. A pasta antiga é removida após a verificação e o início do servidor no novo local.</p></span></label>
          <label className={mode==='fresh'?'chosen destructiveOption':'destructiveOption'}><input type="radio" name="storageMode" value="fresh" checked={mode==='fresh'} onChange={()=>{setMode('fresh');setConfirmed(false)}}/><Trash2/><span><b>Excluir a pasta antiga e criar uma nova</b><p>Cria um servidor sem jogos no destino e exclui permanentemente todo o conteúdo da pasta antiga. O catálogo de jogos continua salvo.</p></span></label>
        </fieldset>}
        {destructive && <div className="storageWarning"><AlertTriangle/><div><strong>Os arquivos da pasta antiga serão excluídos</strong><p>Isso inclui ISOs, capas, configurações, cheats e cartões de memória virtuais (VMCs), que podem conter seus saves.</p><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/>Entendo que esses arquivos serão excluídos permanentemente.</label></div></div>}
        {busy && <div className="storageProgress" role="status"><div><Loader2 className="spin"/><b>{phases[progress?.phase||'stopping']}</b><span>{progress?.total?`${percent}%`:''}</span></div><div className="progress"><i style={{width:`${percent}%`}}/></div>{progress?.file&&<small>{progress.file}</small>}<p>Aguarde a conclusão. O servidor e as operações com jogos ficam pausados durante a alteração.</p></div>}
        <div className="formActions"><button disabled={busy} onClick={()=>{setTarget('');setConfirmed(false);setError('')}}>Cancelar</button><button className={destructive?'storageDeleteButton':'primary'} disabled={busy||selecting||(!!destructive&&!confirmed)} onClick={async()=>{
          setBusy(true);onBusy(true);setError('');setMessage('');setWarning('');setProgress(null);
          try {
            const result=await window.games.changeStorageDirectory({directory:target,mode:settings.exists?mode:'fresh'});
            if(!result.cancelled){setMessage('O local do SMB Server foi atualizado. Os próximos downloads e importações usarão a nova pasta.');setWarning(result.warning||'');setTarget('');setConfirmed(false);await read();await onChanged()}
          }catch(err){setError(errorText(err))}finally{setBusy(false);onBusy(false)}
        }}>{busy?<Loader2 className="spin"/>:destructive?<Trash2/>:<MoveRight/>}{busy?'Alterando local…':destructive?'Excluir e criar no novo local':settings.exists?'Migrar para o novo local':'Criar no novo local'}</button></div>
      </>}
      <p className="storageNote">A alteração reinicia o servidor SMB. Termine jogos, downloads e importações antes de continuar. Um destino que já contém uma pasta oplserver não será sobrescrito.</p>
    </> : !error && <div className="settingsLoading"><Loader2 className="spin"/>Verificando a pasta atual…</div>}
    {error&&<div className="formMsg error" role="alert">{error}{!settings&&<button onClick={()=>void read()}><RefreshCw/>Tentar novamente</button>}</div>}
    {message&&<p className="formMsg ok" role="status"><CheckCircle2/>{message}</p>}
    {warning&&<p className="formMsg error" role="alert">{warning}</p>}
  </fieldset><LibrarySettings locked={locked} onBusy={onBusy} onChanged={onChanged}/><DiscordSettings locked={locked}/><CatalogSettings locked={locked} onBusy={onBusy} onChanged={onChanged}/><AppearanceSettings/>
    <section className="settingsPanel tutorialSettings"><div className="settingsTitle"><span className="statIcon"><FolderOpen/></span><div><h2>Primeiros passos</h2><p>Aprenda a conectar o PS2, configurar o OPL e usar sua biblioteca.</p></div></div><button onClick={()=>window.dispatchEvent(new Event('open-tutorial'))}>Abrir tutorial<ArrowRight/></button></section>
  </>;
}
