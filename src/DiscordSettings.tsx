import {useEffect,useState} from 'react';
import {Loader2,LogOut} from 'lucide-react';
import {errorText} from './ui';

function DiscordIcon(){
  return <svg className="discordLogo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.108 13.108 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.095.252-.194.372-.293a.074.074 0 0 1 .077-.01c3.928 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.293a.077.077 0 0 1-.006.128c-.597.35-1.22.649-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.03-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.42-2.157 2.42Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.42-2.157 2.42Z"/></svg>;
}

export function DiscordSettings({locked}:{locked:boolean}){
  const [status,setStatus]=useState<DiscordStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let live=true;
    const apply=(value:DiscordStatus)=>{if(live)setStatus(value)};
    const off=window.games.onDiscordStatus(apply);
    window.games.discordStatus().then(apply).catch(e=>{if(live)setError(errorText(e))});
    return()=>{live=false;off()};
  },[]);

  const connect=async()=>{
    setBusy(true);setError('');
    try{setStatus(await window.games.discordConnect())}
    catch(e){setError(errorText(e))}
    finally{setBusy(false)}
  };
  const disconnect=async()=>{
    setBusy(true);setError('');
    try{setStatus(await window.games.discordDisconnect())}
    catch(e){setError(errorText(e))}
    finally{setBusy(false)}
  };
  const toggle=async(enabled:boolean)=>{
    setBusy(true);setError('');
    try{setStatus(await window.games.discordConfigure(enabled))}
    catch(e){setError(errorText(e))}
    finally{setBusy(false)}
  };

  return <section className="settingsPanel discordSettings">
    <div className="discordAccountCard">
      <div className="discordAccountInfo">
        <span className="discordAccountIcon"><DiscordIcon/></span>
        <div><h2>Discord</h2><span>{status?.user?.name||'Mostre seu jogo e suas conquistas no perfil.'}</span></div>
      </div>
      {status?.user
        ? <button type="button" disabled={locked||busy} onClick={disconnect}>{busy?<Loader2 className="spin"/>:<LogOut/>}Desconectar</button>
        : <button type="button" className="discordConnect" disabled={locked||busy||!status||!status.configured} onClick={connect}>{busy&&<Loader2 className="spin"/>}{busy?'Conectando…':'Conectar Discord'}</button>}
    </div>

    {busy&&!status?.user&&<button type="button" className="textButton" onClick={disconnect}>Cancelar autorização</button>}

    {status?.user&&<fieldset disabled={locked||busy} className="discordFields">
      <label className="discordToggle"><span>Mostrar atividade no Discord</span><input type="checkbox" role="switch" checked={!!status?.enabled} onChange={e=>void toggle(e.target.checked)}/></label>
    </fieldset>}

    {status?.user&&<p role="status" className="discordConnection"><span className={status.connected?'connected':''}/>{status.message}</p>}
    {error&&<p className="formMsg error" role="alert">{error}</p>}
  </section>;
}
