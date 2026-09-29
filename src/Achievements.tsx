import {useEffect,useRef,useState} from 'react';
import {Trophy,Loader2,RefreshCw,ArrowLeft,ChevronRight,Lock,CheckCircle2} from 'lucide-react';
import {errorText} from './ui';
import {AchievementControls} from './AchievementControls';
import {AchievementsGuide,needsAchievementsGuide} from './AchievementsGuide';

export function Achievements(){
  const [engine,setEngine]=useState<XeraStatus>({running:false,connected:false,user:'',game:'',error:''});
  const [password,setPassword]=useState('');
  const [editingAccount,setEditingAccount]=useState(false);
  const [guide,setGuide]=useState(needsAchievementsGuide);
  const [user,setUser]=useState<string|null>(null),[username,setUsername]=useState(''),[key,setKey]=useState('');
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(0);
  const [games,setGames]=useState<RAGame[]>([]),[total,setTotal]=useState(0);
  const [detail,setDetail]=useState<{title:string;achievements:RAAchievement[]}|null>(null);
  const [filter,setFilter]=useState('all');
  const live=useRef(true);
  useEffect(()=>{live.current=true;window.games.raStatus().then(async status=>{if(!live.current)return;setUser(status.user);if(status.user){setUsername(status.user);await window.games.xeraStart();await load(0)}}).catch(e=>{if(live.current)setError(errorText(e))}).finally(()=>{if(live.current)setBusy(false)});return()=>{live.current=false}},[]);
  useEffect(()=>{const off=window.games.onXeraStatus(setEngine);window.games.xeraStatus().then(setEngine).catch(()=>{});return off},[]);
  async function load(next:number){const data=await window.games.raGames(next);if(live.current){setGames(data.games);setTotal(data.total);setPage(next);setDetail(null)}}
  useEffect(()=>{const refresh=()=>{if(user&&!busy)void run(()=>load(page))};window.addEventListener('achievement-unlocked',refresh);return()=>window.removeEventListener('achievement-unlocked',refresh)},[user,busy,page]);
  async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action()}catch(e){if(live.current)setError(errorText(e))}finally{if(live.current){setBusy(false);setPassword('')}}}
  return <section className="raPage">
    <div className="achievementGuideAction"><button onClick={()=>setGuide(true)}>Como funciona</button></div>
    {guide&&<AchievementsGuide onClose={()=>setGuide(false)}/>}
    <header className="achievementHeader"><span className="raTrophy"><Trophy/></span><div><span className="eyebrow">RETROACHIEVEMENTS</span><h2>Conquistas e progresso</h2><p>Sua biblioteca e a conexão com o PS2 na mesma conta.</p></div><span className="achievementMode">SOFTCORE AO VIVO</span></header>
    {(!user||editingAccount)?<form className="settingsPanel raConnect" onSubmit={event=>{event.preventDefault();void run(async()=>{const status=await window.games.raConnect(username,key,password);if(!live.current)return;setKey('');setPassword('');setEditingAccount(false);setUser(status.user);await load(0)})}}>
      <h3>Conecte sua conta</h3><p>Um acesso para consultar sua biblioteca e registrar conquistas ao vivo. A senha autentica o jogo; a Web API Key permite consultar o progresso.</p>
      <label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" maxLength={100} required disabled={busy}/></label>
      <label>Senha<input type="password" name="raPassword" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" maxLength={250} required disabled={busy}/></label>
      <label>Web API Key<input name="raKey" type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="off" maxLength={256} required disabled={busy}/></label>
      <small>Obtenha sua Web API Key em retroachievements.org/settings. Senha usada somente para autenticar, sem salvar. Token e chave ficam protegidos pelo Windows.</small>
      <button className="primary" disabled={busy||!username.trim()||!key.trim()||!password}>{busy?<Loader2 className="spin"/>:<Lock/>}{busy?'Conectando conta…':'Entrar'}</button>
    </form>:<>
      <div className="achievementSession"><div><small>CONTA</small><b>{user}</b></div><div><small>CONEXÃO AO VIVO</small><b>{!engine.running?'Pausada':engine.user?'Conta conectada':'Aguardando autenticação'}</b></div><div><small>PLAYSTATION 2</small><b>{engine.connected?'Recebendo telemetria':'Aguardando console'}</b></div>{engine.game&&<div><small>JOGO ATUAL</small><b>{engine.game}</b></div>}</div>
      {engine.running&&!engine.user&&!busy&&<p className="formMsg">Se você conectou apenas a consulta anteriormente, <button onClick={()=>setEditingAccount(true)}>Completar conexão</button></p>}
      <AchievementControls status={engine} busy={busy} run={run}/>
      <div className="raToolbar"><div><b>{user}</b><small>Consulta de todas as plataformas · atualizações em cache por 1 minuto</small></div><button disabled={busy} onClick={()=>void run(()=>load(page))}><RefreshCw/>Atualizar</button><button disabled={busy} onClick={()=>void run(async()=>{await window.games.raDisconnect();setUser(null);setGames([]);setDetail(null);setKey('');setPassword('')})}>Desconectar</button></div>
      {detail?<><div className="raToolbar"><button disabled={busy} onClick={()=>setDetail(null)}><ArrowLeft/>Jogos</button><h3>{detail.title}</h3><select aria-label="Filtrar conquistas" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="earned">Desbloqueadas</option><option value="locked">Bloqueadas</option><option value="hardcore">Hardcore</option></select></div>
        <div className="raBadges">{detail.achievements.filter(a=>filter==='all'||(filter==='earned'?a.earned:filter==='locked'?!a.earned:a.hardcore)).map(a=><article className={`raBadge ${a.earned?'earned':''}`} key={a.id}>{a.image?<img src={a.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<Trophy/>}<div><h4>{a.title}</h4><p>{a.description}</p><small>{a.hardcore?'Hardcore':a.earned?'Desbloqueada':'Bloqueada'}{a.date?` · ${a.date}`:''}</small></div><b>{a.points} pts</b>{a.earned?<CheckCircle2/>:<Lock/>}</article>)}</div>
        {!detail.achievements.some(a=>filter==='all'||(filter==='earned'?a.earned:filter==='locked'?!a.earned:a.hardcore))&&<p className="raEmpty">Nenhuma conquista neste filtro.</p>}
      </>:<><div className="raGames">{games.map(game=><button className="raGame" key={game.id} disabled={busy} onClick={()=>void run(async()=>{const result=await window.games.raGame(game.id);if(live.current){setDetail(result);setFilter('all')}})}>{game.image?<img src={game.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<Trophy/>}<span><small>{game.console}</small><b>{game.title}</b><span>{game.earned} / {game.total} conquistas · {game.hardcore} hardcore</span><span className="progress"><i style={{width:`${game.total?Math.min(100,game.earned/game.total*100):0}%`}}/></span></span><ChevronRight/></button>)}</div>
        {!games.length&&!busy&&!error&&<p className="raEmpty">Nenhum jogo com progresso encontrado nesta conta.</p>}
        <div className="raPagination"><button disabled={busy||page===0} onClick={()=>void run(()=>load(page-1))}>Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(total/100))}</span><button disabled={busy||(page+1)*100>=total} onClick={()=>void run(()=>load(page+1))}>Próxima</button></div>
      </>}
    </>}
    {busy&&<p className="raLoading" role="status"><Loader2 className="spin"/>Consultando RetroAchievements…</p>}
    {(error||engine.error)&&<div className="formMsg error" role="alert">{error||engine.error}</div>}
  </section>;
}
