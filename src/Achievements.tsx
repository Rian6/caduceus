import {useEffect,useRef,useState} from 'react';
import {Trophy,Loader2,RefreshCw,ArrowLeft,ChevronRight,Lock,CheckCircle2} from 'lucide-react';
import {errorText} from './ui';

export function Achievements(){
  const [user,setUser]=useState<string|null>(null),[username,setUsername]=useState(''),[key,setKey]=useState('');
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(0);
  const [games,setGames]=useState<RAGame[]>([]),[total,setTotal]=useState(0);
  const [detail,setDetail]=useState<{title:string;achievements:RAAchievement[]}|null>(null);
  const [filter,setFilter]=useState('all');
  const live=useRef(true);
  useEffect(()=>{live.current=true;window.games.raStatus().then(async status=>{if(!live.current)return;setUser(status.user);if(status.user)await load(0)}).catch(e=>{if(live.current)setError(errorText(e))}).finally(()=>{if(live.current)setBusy(false)});return()=>{live.current=false}},[]);
  async function load(next:number){const data=await window.games.raGames(next);if(live.current){setGames(data.games);setTotal(data.total);setPage(next);setDetail(null)}}
  async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action()}catch(e){if(live.current)setError(errorText(e))}finally{if(live.current)setBusy(false)}}
  return <section className="raPage">
    <div className="raBanner"><span className="raTrophy"><Trophy/></span><div><span className="eyebrow">RETROACHIEVEMENTS</span><h2>Suas conquistas</h2><p>Consulte o progresso registrado na sua conta. Esta integração não desbloqueia conquistas nem envia partidas do OPL.</p></div></div>
    {!user?<form className="settingsPanel raConnect" onSubmit={event=>{event.preventDefault();void run(async()=>{const status=await window.games.raConnect(username,key);if(!live.current)return;setKey('');setUser(status.user);await load(0)})}}>
      <h3>Conectar para consultar</h3><p>Informe seu usuário e a Web API Key disponível em retroachievements.org/settings. Use a chave da API, não a senha da conta.</p>
      <label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" maxLength={100} required disabled={busy}/></label>
      <label>Web API Key<input type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="off" maxLength={256} required disabled={busy}/></label>
      <small>A chave fica apenas nesta sessão e é descartada ao fechar o aplicativo.</small>
      <button className="primary" disabled={busy||!username.trim()||!key.trim()}>{busy?<Loader2 className="spin"/>:<Lock/>}Conectar</button>
    </form>:<>
      <div className="raToolbar"><div><b>{user}</b><small>Consulta de todas as plataformas · atualizações em cache por 1 minuto</small></div><button disabled={busy} onClick={()=>void run(()=>load(page))}><RefreshCw/>Atualizar</button><button disabled={busy} onClick={()=>void run(async()=>{await window.games.raDisconnect();setUser(null);setGames([]);setDetail(null);setKey('')})}>Desconectar</button></div>
      {detail?<><div className="raToolbar"><button disabled={busy} onClick={()=>setDetail(null)}><ArrowLeft/>Jogos</button><h3>{detail.title}</h3><select aria-label="Filtrar conquistas" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="earned">Desbloqueadas</option><option value="locked">Bloqueadas</option><option value="hardcore">Hardcore</option></select></div>
        <div className="raBadges">{detail.achievements.filter(a=>filter==='all'||(filter==='earned'?a.earned:filter==='locked'?!a.earned:a.hardcore)).map(a=><article className={`raBadge ${a.earned?'earned':''}`} key={a.id}>{a.image?<img src={a.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<Trophy/>}<div><h4>{a.title}</h4><p>{a.description}</p><small>{a.hardcore?'Hardcore':a.earned?'Desbloqueada':'Bloqueada'}{a.date?` · ${a.date}`:''}</small></div><b>{a.points} pts</b>{a.earned?<CheckCircle2/>:<Lock/>}</article>)}</div>
        {!detail.achievements.some(a=>filter==='all'||(filter==='earned'?a.earned:filter==='locked'?!a.earned:a.hardcore))&&<p className="raEmpty">Nenhuma conquista neste filtro.</p>}
      </>:<><div className="raGames">{games.map(game=><button className="raGame" key={game.id} disabled={busy} onClick={()=>void run(async()=>{const result=await window.games.raGame(game.id);if(live.current){setDetail(result);setFilter('all')}})}>{game.image?<img src={game.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<Trophy/>}<span><small>{game.console}</small><b>{game.title}</b><span>{game.earned} / {game.total} conquistas · {game.hardcore} hardcore</span><span className="progress"><i style={{width:`${game.total?Math.min(100,game.earned/game.total*100):0}%`}}/></span></span><ChevronRight/></button>)}</div>
        {!games.length&&!busy&&!error&&<p className="raEmpty">Nenhum jogo com progresso encontrado nesta conta.</p>}
        <div className="raPagination"><button disabled={busy||page===0} onClick={()=>void run(()=>load(page-1))}>Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(total/100))}</span><button disabled={busy||(page+1)*100>=total} onClick={()=>void run(()=>load(page+1))}>Próxima</button></div>
      </>}
    </>}
    {busy&&<p className="raLoading" role="status"><Loader2 className="spin"/>Consultando RetroAchievements…</p>}
    {error&&<div className="formMsg error" role="alert">{error}</div>}
  </section>;
}
