import {useEffect,useState} from 'react';
import {Disc3,Loader2,FileUp,Plus,Trash2,CheckCircle2} from 'lucide-react';
import {Cover,Modal,bytes,errorText} from './ui';
import {RADetails} from './RACompatibility';

const blankForm = {title: '', icon: '', downloadUrl: '', originalName: ''};

export function CreateGame({onSaved}: {onSaved: () => Promise<void>}) {
  const [form, setForm] = useState(blankForm);
  const [iso, setIso] = useState<Awaited<ReturnType<GamesAPI['selectIso']>>>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [created, setCreated] = useState<Game | null>(null);
  useEffect(() => window.games.onIsoProgress(data => {
    if (created && String(data.gameKey) === created._id) setProgress(Number(data.percent || 0));
  }), [created]);
  const reset = () => { setForm(blankForm); setIso(null); setCreated(null); setProgress(0); setError(''); setSuccess(''); };

  return <section className="createLayout">
    <form className="formPanel" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setSuccess('');
      try {
        const game = created || await window.games.create(form);
        setCreated(game);
        if (iso) {
          let result = await window.games.importIso(iso.path, game, false);
          if (result?.exists) {
            if (!confirm(`${result.fileName} já existe. Substituir a ISO?`)) throw new Error('Jogo cadastrado. A importação foi cancelada; você pode tentar novamente.');
            result = await window.games.importIso(iso.path, game, true);
          }
          if (!result?.success) throw new Error('Jogo cadastrado, mas não foi possível importar a ISO. Tente novamente.');
        }
        reset(); setSuccess(`${game.title} adicionado à sua coleção${iso ? ' e ISO importada' : ''}.`);
        await onSaved();
      } catch (err) { setError(errorText(err)); }
      finally { setBusy(false); }
    }}>
      <div className="formSectionTitle"><span className="stepNumber">01</span><div><h2>Detalhes do jogo</h2><p>Informe o título e os dados do jogo.</p></div></div>
      <fieldset disabled={busy || !!created} className="formFields">
        <label className="wide"><span>Título do jogo <em>*</em></span><input required value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="Ex.: Shadow of the Colossus"/></label>
        <label className="wide"><span>URL da capa <small>Opcional</small></span><input type="url" value={form.icon} onChange={e => setForm({...form, icon:e.target.value})} placeholder="https://exemplo.com/capa.jpg"/></label>
        <label className="wide"><span>Link de download <small>Opcional</small></span><input type="url" value={form.downloadUrl} onChange={e => setForm({...form, downloadUrl:e.target.value})} placeholder="https://exemplo.com/jogo.iso"/></label>
        <label className="wide"><span>Nome do arquivo <small>Opcional</small></span><input value={form.originalName} onChange={e => setForm({...form, originalName:e.target.value})} placeholder="jogo.iso"/></label>
      </fieldset>
      <div className="formSectionTitle"><span className="stepNumber">02</span><div><h2>Importar da sua máquina</h2><p>Selecione um arquivo ISO local.</p></div></div>
      <div className={`isoDrop ${iso ? 'hasFile' : ''}`}>
        {iso&&<RADetails value={iso.ra}/>}
        <div className="isoDropIcon"><Disc3/></div><b>{iso?.fileName || 'Nenhum arquivo selecionado'}</b>
        <p>{iso ? bytes(iso.size) : 'Selecione uma ISO. O arquivo original será preservado.'}</p>
        <div className="buttonRow"><button type="button" disabled={busy || !!created} onClick={async () => {
          try { const file = await window.games.selectIso(); if (file) {setIso(file);setForm(value => ({...value, title:value.title || file.suggestedTitle, originalName:file.fileName}));} }
          catch (err) { setError(errorText(err)); }
        }}><FileUp/>{iso ? 'Trocar arquivo' : 'Selecionar ISO'}</button>
        {iso && <button type="button" className="textButton" disabled={busy || !!created} onClick={() => setIso(null)}>Remover</button>}</div>
        {busy && iso && <div className="importProgress"><div className="progress"><i style={{width:`${progress}%`}}/></div><span>Importando · {progress}%</span></div>}
      </div>
      {error && <p className="formMsg error" role="alert">{error}</p>}
      {success && <p className="formMsg ok" role="status"><CheckCircle2/>{success}</p>}
      <div className="formActions"><button type="button" className="textButton" disabled={busy} onClick={reset}>Limpar campos</button><button className="primary" disabled={busy}>{busy ? <><Loader2 className="spin"/>Salvando…</> : <><Plus/>{created ? 'Tentar importação novamente' : 'Adicionar à coleção'}</>}</button></div>
    </form>
    <aside className="createPreview"><span className="eyebrow">PRÉVIA DO JOGO</span><Cover src={form.icon} title={form.title || 'Nome do jogo'}/><span className="platformLabel">PLAYSTATION 2</span><h3>{form.title || 'Nome do jogo'}</h3><p>A capa e os detalhes aparecerão assim na sua biblioteca.</p><div className="previewNote"><Disc3/><span>A ISO será copiada para a pasta de jogos do OPL.</span></div></aside>
  </section>;
}

export function EditGame({game,onClose,onSaved}:{game:Game;onClose:()=>void;onSaved:()=>void | Promise<void>}){
 const initial=(game.downloads?.length?game.downloads:(game.downloadUrl?[{name:'Download',url:game.downloadUrl,originalName:game.originalName||''}]:[]));
 const[form,setForm]=useState<any>({title:game.title||'',console:game.console||'PS2',icon:game.icon||'',originalName:game.originalName||'',source:game.source||'',gameId:game.gameId||'',downloads:initial.map(x=>({...x}))});
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[isoBusy,setIsoBusy]=useState(false),[isoPct,setIsoPct]=useState(0);
 const change=(i:number,k:string,v:string)=>setForm((f:any)=>({...f,downloads:f.downloads.map((d:any,n:number)=>n===i?{...d,[k]:v}:d)}));
 useEffect(()=>{const a=window.games.onIsoProgress((d:any)=>{if(String(d.gameKey)===String(game._id))setIsoPct(Number(d.percent||0))});return()=>a()},[game._id]);
 return <Modal title="Editar jogo" onClose={()=>{if(!busy&&!isoBusy)onClose()}} className="editModal"><div className="editHead"><div><small>CATÁLOGO</small><h2>Editar jogo</h2><p>Todos os campos podem ser alterados. Sem URLs, o download ficará indisponível.</p></div></div><div className="editGrid"><label><span>Título</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span>Console</span><input value={form.console} onChange={e=>setForm({...form,console:e.target.value})}/></label><label className="wide"><span>URL da capa</span><input value={form.icon} onChange={e=>setForm({...form,icon:e.target.value})}/></label><label><span>Nome original</span><input value={form.originalName} onChange={e=>setForm({...form,originalName:e.target.value})}/></label><label><span>Fonte</span><input value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></label><label><span>Game ID</span><input value={form.gameId} onChange={e=>setForm({...form,gameId:e.target.value})} placeholder="SLUS_000.00"/></label></div><div className="editIso"><div><Disc3/><span><b>Arquivo ISO local</b><small>Importe ou substitua a ISO deste jogo diretamente em PS2\DVD.</small></span></div><button disabled={isoBusy} onClick={async()=>{const f=await window.games.selectIso();if(!f)return;setIsoBusy(true);setIsoPct(0);setError('');try{let r=await window.games.importIso(f.path,{...game,...form},false);if(r?.exists){if(!confirm(`${r.fileName} já existe em PS2\\DVD. Substituir?`))return;r=await window.games.importIso(f.path,{...game,...form},true)}if(r?.success){setForm((x:any)=>({...x,originalName:r.fileName,gameId:r.gameId||x.gameId}));alert(`ISO importada para PS2\\DVD\\${r.fileName}`)}}catch(e){setError(errorText(e))}finally{setIsoBusy(false)}}}>{isoBusy?<><Loader2 className="spin"/>{isoPct?`${isoPct}%`:'Importando...'}</>:<><FileUp/>Importar ISO</>}</button></div><div className="downloadEditor"><div className="downloadEditorHead"><div><b>Opções de download</b><small>Você pode deixar esta lista vazia.</small></div><button onClick={()=>setForm((f:any)=>({...f,downloads:[...f.downloads,{name:'Nova opção',url:'',region:'',format:'',size:'',source:'manual',originalName:''}]}))}><Plus/>Adicionar opção</button></div>{form.downloads.length===0?<div className="noDownloads">Nenhum download cadastrado — o botão ficará desabilitado.</div>:form.downloads.map((d:any,i:number)=><div className="downloadRow" key={i}><input placeholder="Nome" value={d.name||''} onChange={e=>change(i,'name',e.target.value)}/><input className="urlField" placeholder="https://..." value={d.url||''} onChange={e=>change(i,'url',e.target.value)}/><input placeholder="Região" value={d.region||''} onChange={e=>change(i,'region',e.target.value)}/><input placeholder="Formato" value={d.format||''} onChange={e=>change(i,'format',e.target.value)}/><input placeholder="Tamanho" value={d.size||''} onChange={e=>change(i,'size',e.target.value)}/><button className="removeOption" aria-label="Remover opção de download" onClick={()=>setForm((f:any)=>({...f,downloads:f.downloads.filter((_:any,n:number)=>n!==i)}))}><Trash2/></button></div>)}</div>{error&&<p className="formMsg error" role="alert">{error}</p>}<div className="editActions"><button disabled={busy||isoBusy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy||isoBusy} onClick={async()=>{setBusy(true);setError('');try{await window.games.update({...game,...form});await onSaved()}catch(e){setError(errorText(e))}finally{setBusy(false)}}}>{busy?<><Loader2 className="spin"/>Salvando...</>:<><CheckCircle2/>Salvar alterações</>}</button></div></Modal>
}
