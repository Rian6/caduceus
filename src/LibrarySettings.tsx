import {useState} from 'react';
import {Image, Trophy, Loader2, Library} from 'lucide-react';
import {errorText} from './ui';
export function LibrarySettings({locked,onBusy,onChanged}:{locked:boolean;onBusy:(busy:boolean)=>void;onChanged:()=>Promise<void>}){
  const [task,setTask]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function run(action:'covers'|'ra'){
    setTask(action);onBusy(true);setMessage('');setError('');
    try{
      if(action==='covers'){const result=await window.games.repairCovers();setMessage(`${result.repaired} capas reparadas.`)}
      else{await window.games.raCompatibilitySync();setMessage('Compatibilidade atualizada.')}
      await onChanged();
    }catch(e){setError(errorText(e))}finally{setTask('');onBusy(false)}
  }
  return <section className="settingsPanel librarySettings"><div className="settingsTitle"><span className="statIcon"><Library/></span><div><h2>Biblioteca</h2></div></div>
    <div className="librarySettingRow"><div><h3>Capas do OPL</h3><p>Reinstale as capas dos jogos instalados.</p></div><button disabled={locked||!!task} onClick={()=>void run('covers')}>{task==='covers'?<Loader2 className="spin"/>:<Image/>}Reparar capas</button></div>
    <div className="librarySettingRow"><div><h3>RetroAchievements</h3><p>Verifique as ISOs da sua coleção.</p></div><button disabled={locked||!!task} onClick={()=>void run('ra')}>{task==='ra'?<Loader2 className="spin"/>:<Trophy/>}Verificar compatibilidade</button></div>
    {message&&<p className="formMsg ok" role="status">{message}</p>}{error&&<p className="formMsg error" role="alert">{error}</p>}
  </section>;
}
