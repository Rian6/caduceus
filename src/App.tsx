import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Gamepad2, Download, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Loader2, Trash2, Library, HardDrive, Wifi, WifiOff, Plus, Pencil, ArrowUpRight, ArrowRight, Disc3, X, Check, AlertCircle, LayoutGrid, Settings2 } from 'lucide-react';
import { CreateGame, EditGame } from './GameForms';
import { Cover, Modal, bytes, errorText, isDownloading } from './ui';
import { Settings } from './Settings';
import { Achievements } from './Achievements';
import {AchievementNotifications} from './LiveAchievements';
import { Trophy } from 'lucide-react';
import {RABadge,RADetails} from './RACompatibility';
import { GettingStarted, needsTutorial } from './GettingStarted';
import caduceusIcon from '../assets/caduceus-icon.png';

const PAGE_SIZE = 24;
type View = 'library' | 'installed' | 'downloads' | 'create' | 'settings' | 'achievements';
const viewNames: Record<View, string> = { achievements: 'Conquistas', library: 'Biblioteca', installed: 'Instalados', downloads: 'Downloads', create: 'Adicionar jogo', settings: 'Configurações' };
const number = (value: number) => value.toLocaleString('pt-BR');

export default function App() {
  const [tutorial, setTutorial] = useState(needsTutorial);
  useEffect(() => { const open = () => setTutorial(true); window.addEventListener('open-tutorial', open); return () => window.removeEventListener('open-tutorial', open) }, []);
  const [view, setView] = useState<View>('library');
  const [storageBusy, setStorageBusy] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [installed, setInstalled] = useState<Game[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [opl, setOpl] = useState<OplStatus | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [selected, setSelected] = useState<Game | null>(null);
  const [editing, setEditing] = useState<Game | null>(null);
  const [raOnly,setRaOnly]=useState(false);
  const request = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const notify = (message: string, error = false) => setToast({ message, error });

  useEffect(() => { const timeout = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 250); return () => clearTimeout(timeout); }, [search]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setLoadError('');
    try {
      const [result, states, status, local, stats] = await Promise.all([
        window.games.list({ search: query, console: 'PS2', page, limit: PAGE_SIZE,raCompatible:raOnly }), window.games.downloads(),
        window.games.oplStatus(), window.games.installed(), window.games.stats()
      ]);
      if (id !== request.current) return;
      setGames(result.games); setPages(result.pages); setTotal(result.total);
      setInstalled(local); setOpl(status); setCatalogTotal(Number(stats.total || 0));
      setDownloads(Object.fromEntries(states.map(state => [state.gameKey, state])));
      if (result.pages && page >= result.pages) setPage(result.pages - 1);
    } catch (error) { if (id === request.current) setLoadError(errorText(error)); }
    finally { if (id === request.current) setLoading(false); }
  }, [query, page,raOnly]);
  useEffect(() => { void load(); return () => { request.current++; }; }, [load]);
  useEffect(() => {
    const update = (state: DownloadState) => setDownloads(previous => ({ ...previous, [state.gameKey]: state }));
    const off = [window.games.onDownloadProgress(update), window.games.onDownloadCompleted(state => {
      update(state); notify(`${state.fileName} está pronto para jogar.`); void load();
    }), window.games.onDownloadError(state => { update(state); notify(state.error || 'Não foi possível concluir o download.', true); }), window.games.onOplStatus(setOpl)];
    return () => off.forEach(unsubscribe => unsubscribe());
  }, [load]);
  useEffect(() => {
    let live = true, changed = false;
    const off = window.games.onNowPlaying(game => { changed = true; if (live) setNowPlaying(game); });
    window.games.nowPlaying().then(game => { if (live && !changed) setNowPlaying(game); }).catch(() => { });
    return () => { live = false; off(); };
  }, []);

  const activeDownloads = useMemo(() => Object.values(downloads).filter(isDownloading), [downloads]);
  const localGames = useMemo(() => installed.filter(game => game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(!raOnly||game.ra?.status==='compatible')), [installed, query,raOnly]);
  const visible = view === 'installed' ? localGames : games;
  const currentGame = nowPlaying ? [...installed, ...games].find(game => (nowPlaying.id && String(nowPlaying.id) === game._id) || (nowPlaying.gameId && game.gameId === nowPlaying.gameId) || game.title === nowPlaying.title) : undefined;
  const currentCover = nowPlaying?.icon || currentGame?.icon;
  const changeView = (next: View) => { if (storageBusy) return; setView(next); setSearch(''); setQuery(''); setPage(0); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const showCurrentGame = () => { if (currentGame) setSelected(currentGame); else if (nowPlaying) setSelected({ _id: String(nowPlaying.id || 'current'), title: nowPlaying.title, console: 'PS2', icon: currentCover, gameId: nowPlaying.gameId, originalName: nowPlaying.fileName, downloaded: true }); };

  return <div className="appShell">
    <AchievementNotifications/>
    <aside className="sidebar" inert={storageBusy}>
      <button
        className="brand"
        onClick={() => changeView('library')}
        aria-label="Caduceus, ir para biblioteca"
      >
        <span className="brandMark brandMarkCaduceus">
          <img src={caduceusIcon} alt="" />
        </span>
        <span>CADUCEUS</span>
      </button>
      <div className="navLabel">SEU ESPAÇO</div>
      <nav aria-label="Navegação principal">
        <button className={view === 'library' ? 'active' : ''} aria-current={view === 'library' ? 'page' : undefined} onClick={() => changeView('library')}><LayoutGrid />Biblioteca<span>{catalogTotal ? number(catalogTotal) : ''}</span></button>
        <button className={view === 'installed' ? 'active' : ''} aria-current={view === 'installed' ? 'page' : undefined} onClick={() => changeView('installed')}><HardDrive />Instalados<span>{installed.length || ''}</span></button>
        <button className={view === 'downloads' ? 'active' : ''} aria-current={view === 'downloads' ? 'page' : undefined} onClick={() => changeView('downloads')}><Download />Downloads{activeDownloads.length > 0 && <span className="navCount">{activeDownloads.length}</span>}</button>
        <button className={view === 'achievements' ? 'active' : ''} aria-current={view === 'achievements' ? 'page' : undefined} onClick={() => changeView('achievements')}><Trophy />Conquistas</button>
      </nav>
      <div className="sidebarDivider" />
      <button className={`addGameNav ${view === 'create' ? 'active' : ''}`} onClick={() => changeView('create')}><Plus />Adicionar jogo<ArrowUpRight /></button>
      <button className={`addGameNav ${view === 'settings' ? 'active' : ''}`} onClick={() => changeView('settings')}><Settings2 />Configurações</button>
      <div className="sidebarBottom">
        {nowPlaying && (
          <button className="miniPlaying" onClick={showCurrentGame}>
            <Cover src={currentCover} title={nowPlaying.title} />

            <span>
              <small>
                <span className="liveDot" />
                AGORA JOGANDO
              </small>

              <b>{nowPlaying.title}</b>
            </span>

            <ChevronRight />
          </button>
        )}

        <div className="consoleCard">
          <div className="consoleCardTop">
            <span className="consoleIcon caduceusServerIcon">
              <img src={caduceusIcon} alt="" />
            </span>

            <span>
              Caduceus
              <small>Servidor SMB</small>
            </span>
          </div>

          <div className="consoleConnection">
            <span
              className={`statusDot ${opl?.online ? 'online' : ''}`}
            />

            {opl?.online ? 'Servidor disponível' : 'Servidor offline'}

            <code className="sidebarAddress">
              {opl ? `${opl.ip}:${opl.port}` : "..."}
            </code>

            <span className="connectionBars">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </div>
    </aside>

    <main className="mainContent">
      <header className="topbar"><div className="breadcrumb">Sua coleção<ChevronRight /><b>{viewNames[view]}</b></div><div className="topbarRight"><span className="platformChip"><Gamepad2 />PLAYSTATION 2</span><span className="topbarDivider" /><span className={`serverBadge ${opl?.online ? 'online' : ''}`}><span className="statusDot" />{opl?.online ? 'SERVIDOR online' : 'SERVIDOR offline'}</span></div></header>
      <div className="pageContent">
        <section className="pageHeading"><div><h1>{viewNames[view]}</h1><p>{view === 'achievements' ? 'Consulte seu progresso no RetroAchievements.' : view === 'library' ? 'Consulte e gerencie seus jogos de PlayStation 2.' : view === 'installed' ? 'Jogos disponíveis no servidor SMB.' : view === 'downloads' ? 'Acompanhe o progresso e o status dos downloads.' : view === 'settings' ? 'Defina o local dos arquivos do servidor e dos jogos.' : 'Adicione um jogo ou importe uma ISO da sua coleção.'}</p></div><div className="headingActions"><button className="iconButton" title="Atualizar coleção" aria-label="Atualizar coleção" disabled={loading || storageBusy} onClick={() => void load()}><RefreshCw className={loading ? 'spin' : ''} /></button>{view !== 'create' && view !== 'settings' && view !== 'achievements' && <button className="primary" onClick={() => changeView('create')}><Plus />Adicionar jogo</button>}</div></section>

        {(view === 'library' || view === 'installed') && <>
          <section className={`feature ${nowPlaying ? 'isPlaying' : ''}`}>
            {nowPlaying && currentCover && <div className="featureBackdrop" style={{ backgroundImage: `url(${JSON.stringify(currentCover)})` }} />}
            <div className="featurePattern" aria-hidden="true" />
            <div className="featureCopy"><span className="featureKicker">{nowPlaying ? <><span className="equalizer"><i /><i /><i /><i /></span>JOGO EM EXECUÇÃO</> : <><Wifi /> SERVIDOR SMB</>}</span>
              <h2>{nowPlaying ? nowPlaying.title : opl?.online ? 'Servidor online' : 'Servidor offline'}</h2>
              <p>{nowPlaying ? nowPlaying.fileName : opl?.online ? 'Consulte os jogos instalados e disponíveis para o PS2.' : 'Verifique a conexão com o servidor SMB.'}</p>
              {currentGame && <RABadge value={currentGame.ra}/>}<div className="featureActions">{nowPlaying ? <><span className="playingPill"><span className="liveDot" />Em execução</span><button className="featureLink" onClick={showCurrentGame}>Ver jogo<ArrowUpRight /></button></> : <button className="featureButton" onClick={() => { if (view !== 'installed') changeView('installed'); else document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver jogos instalados<ArrowRight /></button>}</div>
              {nowPlaying?.gameId && <span className="featureGameId">{nowPlaying.gameId}<span>•</span>PLAYSTATION 2</span>}
            </div>
            <div className={`featureArt ${nowPlaying ? 'activeArt' : ''}`} aria-hidden="true">
              <div className="orbit orbitOne" /><div className="orbit orbitTwo" /><span className="artStar starOne">+</span><span className="artStar starTwo">+</span>
              {nowPlaying ? <><div className="gameDisc" /><div className="featuredCase"><div className="caseHeader">PlayStation 2 <span>●</span></div><Cover src={currentCover} title={nowPlaying.title} /></div><span className="artCaption"><span className="liveDot" />EM EXECUÇÃO</span></> : <><div className="consoleSculpture"><div className="consoleFace"><span>PS2</span><i /><b>PlayStation 2</b></div><div className="consoleEdge" /></div><div className="controllerSilhouette"><Gamepad2 strokeWidth={1} /></div><span className="artCaption">PLAYSTATION 2</span></>}
            </div>
          </section>
          <section className="collectionStats" aria-label="Resumo da coleção"><div><span className="statIcon"><Library /></span><span><b>{number(catalogTotal)}</b><small>jogos na coleção</small></span></div><div><span className="statIcon"><Disc3 /></span><span><b>{number(installed.length)}</b><small>jogos instalados</small></span></div><div><span className="statIcon"><Download /></span><span><b>{number(activeDownloads.length)}</b><small>downloads ativos</small></span></div><div className="connectionStat"><span className={`statIcon ${opl?.online ? 'connected' : ''}`}>{opl?.online ? <Wifi /> : <WifiOff />}</span><span><b>{opl?.online ? 'Servidor online' : 'Servidor offline'}</b><small>{opl ? `${opl.ip}:${opl.port}` : 'Verificando servidor…'}</small></span></div></section>
        </>}

        {loadError && <div className="errorBanner" role="alert"><AlertCircle /><span>{loadError}</span><button onClick={() => void load()}>Tentar novamente</button></div>}
        {view === 'achievements' ? <Achievements/> : view === 'settings' ? <Settings onChanged={load} onBusy={setStorageBusy} locked={storageBusy} /> : view === 'create' ? <CreateGame onSaved={load} /> : view === 'downloads' ? <DownloadsPanel downloads={Object.values(downloads)} onExplore={() => changeView('library')} /> : <section id="collection" className="collectionSection">
          <div className="sectionTop"><div className="collectionTabs" role="group" aria-label="Coleção"><button className={view === 'library' ? 'selected' : ''} onClick={() => changeView('library')}>Todos os jogos<span>{number(catalogTotal)}</span></button><button className={view === 'installed' ? 'selected' : ''} onClick={() => changeView('installed')}>Instalados<span>{installed.length}</span></button></div><span className="sortLabel">A — Z</span></div>
          <div className="toolbar"><label className="searchBox"><Search /><input ref={searchInput} aria-label="Buscar jogos" placeholder="Buscar pelo título do jogo" value={search} onChange={event => setSearch(event.target.value)} />{search ? <button className="clearSearch" aria-label="Limpar busca" onClick={() => setSearch('')}><X /></button> : <kbd>Ctrl K</kbd>}</label><div className="collectionFilters" role="group" aria-label="Filtros"><button className={raOnly?'selected':''} aria-pressed={raOnly} onClick={()=>{setRaOnly(!raOnly);setPage(0)}}><Trophy/>Com conquistas</button></div><span className="resultCount">{loading ? 'Atualizando…' : `${number(view === 'installed' ? localGames.length : total)} jogos${query ? ' encontrados' : ''}`}</span></div>
          {activeDownloads.length > 0 && <button className="downloadStrip" onClick={() => changeView('downloads')}><span className="downloadStripIcon"><Download /></span><span><b>{activeDownloads.length === 1 ? 'Download em andamento' : `${activeDownloads.length} downloads em andamento`}</b><small>{activeDownloads[0].fileName}</small></span><div className="stripProgress"><div className="progress"><i style={{ width: `${activeDownloads[0].percent}%` }} /></div><small>{activeDownloads[0].percent}%</small></div><ArrowRight /></button>}
          {loading && visible.length === 0 ? <div className="gameGrid" aria-label="Carregando jogos" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className="skeletonCard" key={index}><div /><span /><span /></div>)}</div> : visible.length === 0 ? <EmptyState icon={query ? <Search /> : <Library />} title={raOnly ? 'Nenhuma ISO compatível encontrada' : query ? 'Nenhum jogo encontrado' : view === 'installed' ? 'Nenhum jogo instalado' : 'Biblioteca vazia'} description={raOnly ? 'Verifique a compatibilidade das imagens instaladas ou remova o filtro para ver toda a coleção.' : query ? `Não encontramos jogos para “${query}”. Tente outro título.` : 'Adicione um jogo ou importe uma ISO para começar.'} action={raOnly ? 'Limpar filtro RA' : query ? 'Limpar busca' : 'Adicionar primeiro jogo'} onAction={() => raOnly ? setRaOnly(false) : query ? setSearch('') : changeView('create')} /> : <div className={`gameGrid ${loading ? 'refreshing' : ''}`}>{visible.map(game => <GameCard key={game._id} game={game} state={downloads[game._id] || game.downloadState || undefined} playing={!!nowPlaying && (game._id === currentGame?._id)} onSelect={() => setSelected(game)} onEdit={() => setEditing(game)} onChanged={load} notify={notify} />)}</div>}
          {view === 'library' && pages > 1 && <footer className="pagination"><span>Página <b>{page + 1}</b> de <b>{number(pages)}</b></span><div><button disabled={page === 0 || loading} onClick={() => { setPage(value => value - 1); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}><ChevronLeft />Anterior</button><span className="pageNumber">{page + 1}</span><button disabled={page >= pages - 1 || loading} onClick={() => { setPage(value => value + 1); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }}>Próxima<ChevronRight /></button></div></footer>}
        </section>}
        <div className="pageFooter"><span>Caduceus</span><span>△ ○ × □</span></div>
      </div>
    </main>
    {tutorial && <GettingStarted status={opl} onClose={() => setTutorial(false)} />}
    {toast && <div className={`toast ${toast.error ? 'toastError' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle /> : <CheckCircle2 />}<span>{toast.message}</span><button className="iconButton" aria-label="Fechar mensagem" onClick={() => setToast(null)}><X /></button></div>}
    {editing && <EditGame game={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); notify('Alterações salvas na sua coleção.'); await load(); }} />}
    {selected && <Modal title={selected.title} onClose={() => setSelected(null)} className="gameDetails"><Cover src={selected.icon} title={selected.title} /><div className="detailContent"><span className="eyebrow">PLAYSTATION 2</span><h2>{selected.title}</h2><span className={`detailStatus ${selected.downloaded ? 'ready' : ''}`}>{selected.downloaded ? <><CheckCircle2 />Disponível no seu PS2</> : <><Library />Na sua coleção</>}</span><RADetails value={selected.ra}/><dl><div><dt>Game ID</dt><dd>{selected.gameId || 'Ainda não identificado'}</dd></div><div><dt>Arquivo</dt><dd>{selected.localFileName || selected.originalName || 'Nenhum arquivo instalado'}</dd></div><div><dt>Capa no OPL</dt><dd>{selected.coverInstalled ? 'Instalada' : 'Não instalada'}</dd></div></dl>{selected._id !== 'current' && <button className="primary" onClick={() => { setEditing(selected); setSelected(null); }}><Pencil />Editar jogo<ArrowUpRight /></button>}</div></Modal>}
  </div>;
}

function EmptyState({ icon, title, description, action, onAction }: { icon: React.ReactNode; title: string; description: string; action: string; onAction: () => void }) {
  return <div className="emptyState"><span className="emptyIcon">{icon}</span><h3>{title}</h3><p>{description}</p><button onClick={onAction}>{action}<ArrowRight /></button></div>;
}

function GameCard({ game, state, playing, onSelect, onEdit, onChanged, notify }: { game: Game; state?: DownloadState; playing: boolean; onSelect: () => void; onEdit: () => void; onChanged: () => Promise<void>; notify: (message: string, error?: boolean) => void }) {
  const [optionIndex, setOptionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const options = game.downloads?.length ? game.downloads : game.downloadUrl ? [{ name: 'Download', url: game.downloadUrl }] : [];
  const option = options[Math.min(optionIndex, Math.max(0, options.length - 1))];
  const active = isDownloading(state);
  const completed = game.downloaded || state?.state === 'completed';
  return <article className={`gameCard ${playing ? 'playingCard' : ''}`}>
    <button className="gameCoverButton" onClick={onSelect} aria-label={`Ver detalhes de ${game.title}`}><Cover src={game.icon} title={game.title} /><span className="coverVignette" /><span className="coverPlatform">PS2</span>{playing ? <span className="coverBadge playingBadge"><span className="liveDot" />JOGANDO</span> : completed ? <span className="coverBadge"><Check />INSTALADO</span> : null}<span className="coverHover"><ArrowUpRight />Ver detalhes</span></button>
    <div className="cardContent"><RABadge value={game.ra}/><button className="gameTitle" title={game.title} onClick={onSelect}>{game.title}</button><div className="gameMeta"><span>{game.gameId || state?.gameId || 'PlayStation 2'}</span>{(game.coverInstalled || state?.coverInstalled) && <span title="Capa instalada no OPL" className="coverReady"><Check />Capa OPL</span>}</div>
      {options.length > 1 && !completed && <select className="downloadSelect" aria-label={`Versão de ${game.title}`} value={optionIndex} disabled={active || busy} onChange={event => setOptionIndex(Number(event.target.value))}>{options.map((item, index) => <option key={index} value={index}>{[item.name || `Opção ${index + 1}`, item.region, item.format, item.size].filter(Boolean).join(' · ')}</option>)}</select>}
      {active && <div className="progress"><i style={{ width: `${state?.percent || 0}%` }} /></div>}
      <div className="cardActions"><button className={`cardDownload ${completed ? 'downloaded' : ''}`} disabled={busy || active || !!completed || !option} onClick={async () => { setBusy(true); try { const result = await window.games.download(game, option); if (result?.alreadyDownloaded) { notify('Este arquivo já está instalado.'); await onChanged(); } } catch (error) { notify(errorText(error), true); } finally { setBusy(false); } }}>{active || busy ? <><Loader2 className="spin" />{active ? state?.state === 'processing' ? 'Preparando…' : `${state?.percent || 0}%` : 'Aguarde…'}</> : completed ? <><CheckCircle2 />Instalado</> : !option ? <><Disc3 />Sem download</> : <><Download />{state?.state === 'interrupted' ? 'Tentar de novo' : 'Baixar jogo'}</>}</button><button className="iconButton" aria-label={`Editar ${game.title}`} title="Editar jogo" onClick={onEdit}><Pencil /></button>{<button className="iconButton danger" aria-label={`Excluir ${game.title}`} title="Excluir jogo" disabled={busy || active || playing} onClick={async () => { if (!confirm(`Excluir ${game.title}? O registro da biblioteca e os arquivos associados, se existirem, serão removidos.`)) return; setBusy(true); try { await window.games.delete({ ...game, gameId: game.gameId || state?.gameId }); await onChanged(); notify('Jogo e registro removidos.'); } catch (error) { notify(errorText(error), true); } finally { setBusy(false); } }}><Trash2 /></button>}</div>
    </div>
  </article>;
}

function DownloadsPanel({ downloads, onExplore }: { downloads: DownloadState[]; onExplore: () => void }) {
  const active = downloads.filter(isDownloading);
  const completed = downloads.filter(item => item.state === 'completed');
  return <section className="downloadsPage"><div className="downloadSummary"><div><Download /><b>{active.length}</b><span>em andamento</span></div><div><CheckCircle2 /><b>{completed.length}</b><span>concluídos nesta sessão</span></div></div>{downloads.length === 0 ? <EmptyState icon={<Download />} title="Nenhum download nesta sessão" description="Inicie um download pela biblioteca para acompanhar o progresso aqui." action="Ir para a biblioteca" onAction={onExplore} /> : <div className="downloadList">{downloads.map(item => <article className="downloadItem" key={item.gameKey}><Cover src={item.icon} title={item.fileName} /><div className="downloadInfo"><div className="downloadTitle"><h3>{item.fileName}</h3><span className={`downloadState ${item.state === 'completed' ? 'done' : ''}`}>{item.state === 'completed' ? 'Concluído' : item.state === 'processing' ? 'Preparando jogo' : isDownloading(item) ? 'Baixando' : item.state === 'cancelled' ? 'Cancelado' : 'Interrompido'}</span></div><RABadge value={item.ra}/><p>{item.error || `${bytes(item.received)} de ${bytes(item.total)}`}</p><div className="downloadProgressRow"><div className="progress"><i style={{ width: `${item.percent}%` }} /></div><b>{item.percent}%</b></div></div>{item.state === 'completed' ? <CheckCircle2 className="downloadDone" /> : isDownloading(item) ? <Loader2 className="spin" /> : <AlertCircle />}</article>)}</div>}</section>;
}
