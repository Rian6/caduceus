import {useEffect, useState} from 'react';
import {CheckCircle2, Copy, Loader2, RefreshCw, Save, Wifi} from 'lucide-react';
import {errorText} from './ui';

export function NetworkSettingsPanel({locked,onBusy,onChanged}:{locked:boolean;onBusy:(busy:boolean)=>void;onChanged:()=>Promise<void>}) {
  const [network,setNetwork] = useState<NetworkSettings|null>(null);
  const [port,setPort] = useState('');
  const [ip,setIp] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const read = async () => {
    setLoading(true);setError('');
    try {
      const status=await window.games.networkSettings();setNetwork(status);setPort(String(status.port));
      setIp(status.addresses.includes(status.ip)?status.ip:status.addresses[0]||'');
    }catch(err){setError(errorText(err))}finally{setLoading(false)}
  };
  useEffect(()=>{
    void read();
    return window.games.onOplStatus(status=>setNetwork(current=>current?{...current,...status}:current));
  },[]);
  const valid=/^\d+$/.test(port)&&Number(port)>=1&&Number(port)<=65535;
  return <section className="settingsPanel networkPanel">
    <div className="settingsTitle"><span className="statIcon"><Wifi/></span><div><h2>Conexão com o PS2</h2><p>Use estes dados na configuração de rede do OPL.</p></div><button className="iconButton" title="Atualizar endereços de rede" aria-label="Atualizar endereços de rede" disabled={locked||loading} onClick={()=>void read()}><RefreshCw className={loading?'spin':''}/></button></div>
    {network&&<>
      <div className="oplConnectionDetails">
        <div><span>IP do computador</span><strong>{ip||'Rede indisponível'}</strong></div>
        <div><span>Porta do servidor</span><strong>{network.port}</strong></div>
        <div><span>Compartilhamento</span><strong>{network.shareName}</strong></div>
        <button disabled={!ip||locked} onClick={async()=>{try{await navigator.clipboard.writeText(`IP: ${ip}\nPorta: ${network.port}\nCompartilhamento: ${network.shareName}`);setMessage('Dados de conexão copiados.')}catch(err){setError(errorText(err))}}}><Copy/>Copiar dados</button>
      </div>
      {network.addresses.length>1&&<label className="networkAddress"><span>Endereço da rede usada pelo PS2</span><select value={ip} disabled={locked} onChange={event=>setIp(event.target.value)}>{network.addresses.map(address=><option key={address} value={address}>{address}</option>)}</select><small>Escolha o endereço da interface conectada à mesma rede do console.</small></label>}
      {!ip&&<p className="formMsg error">Nenhum endereço IPv4 de rede foi encontrado. Conecte o computador à rede do PS2 e atualize os endereços.</p>}
      <form className="portForm" onSubmit={async event=>{
        event.preventDefault();if(!valid||locked)return;
        setBusy(true);onBusy(true);setError('');setMessage('');
        try {
          const status=await window.games.setOplPort(Number(port));setNetwork(status);setPort(String(status.port));
          setMessage('Porta aplicada. Configure a mesma porta no OPL do PS2.');await onChanged();
        }catch(err){setError(errorText(err))}finally{setBusy(false);onBusy(false)}
      }}>
        <label><span>Porta do OPL Server</span><input aria-label="Porta do OPL Server" type="number" min="1" max="65535" step="1" required value={port} disabled={locked} onChange={event=>{setPort(event.target.value);setMessage('')}}/></label>
        <button className="primary" disabled={locked||!valid||Number(port)===network.port}>{busy?<Loader2 className="spin"/>:<Save/>}{busy?'Aplicando…':'Aplicar porta'}</button>
      </form>
      <p className="storageNote">Portas válidas: 1 a 65535. Padrão: 1024. O servidor será reiniciado ao aplicar a alteração. Encerre o jogo no PS2 antes de continuar.</p>
    </>}
    {loading&&!network&&<div className="settingsLoading"><Loader2 className="spin"/>Obtendo dados da rede…</div>}
    {error&&<p className="formMsg error" role="alert">{error}</p>}
    {message&&<p className="formMsg ok" role="status"><CheckCircle2/>{message}</p>}
  </section>;
}
