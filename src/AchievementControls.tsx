import {useState} from 'react';
import {Download,Volume2,Play,Square} from 'lucide-react';
export function AchievementControls({status,busy,run}:{status:XeraStatus;busy:boolean;run:(action:()=>Promise<void>)=>Promise<void>}){
  const [sound,setSound]=useState(()=>localStorage.getItem('achievement-sound')!=='off');
  const [volume,setVolume]=useState(()=>Number(localStorage.getItem('achievement-volume')||50));
  const [saved,setSaved]=useState(false);
  return <details className="achievementOptions"><summary><Volume2/>Som e configuração do PS2</summary>
    <div className="xeraAudio"><label><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);localStorage.setItem('achievement-sound',e.target.checked?'on':'off')}}/>Som de conquista</label><label>Volume<input type="range" aria-label="Volume das conquistas" min="0" max="100" value={volume} onChange={e=>{setVolume(Number(e.target.value));localStorage.setItem('achievement-volume',e.target.value)}}/></label><button onClick={()=>window.dispatchEvent(new Event('test-achievement-sound'))}>Testar som</button></div>
    <div className="buttonRow"><button disabled={busy} onClick={()=>void run(async()=>{status.running?await window.games.xeraStop():await window.games.xeraStart()})}>{status.running?<Square/>:<Play/>}{status.running?'Pausar conexão ao vivo':'Retomar conexão ao vivo'}</button><button disabled={busy} onClick={()=>void run(async()=>{setSaved(await window.games.xeraElf())})}><Download/>Salvar OPL-RA.ELF</button></div>
    {saved&&<p role="status">ELF salvo. Transfira o arquivo para seu PS2.</p>}
    <p>Console e computador na mesma sub-rede, UDP 18194 liberada. No OPL-RA, execute “RA: test PC connection” e “RA: check game support” antes de iniciar o jogo. OPLServer continua servindo suas ISOs.</p>
    <p>Integração experimental, apenas softcore. O fork ainda pode interromper jogos com conquistas via SMB: teste por USB ou disco compatível. Para jogar pela rede sem conquistas, use o OPL normal.</p>
    <small>Componentes: xeRAbora v0.1.0-alpha.12, OPL-RA e rcheevos. Som original Caduceus.</small>
  </details>;
}
