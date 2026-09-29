import {Trophy,ShieldCheck,ScanLine,Info} from 'lucide-react';
export function RABadge({value}:{value?:RACompatible}){
  const ok=value?.status==='compatible';
  return <span className={`raCompatibilityBadge ${ok?'verified':''}`} title={value?.message||'ISO reconhecida pelo RetroAchievements.'}>
    {ok?<Trophy/>:<ScanLine/>}{ok?`RA · ${value.count} conquistas`:value?.status==='unmatched'?'RA · Sem correspondência':value?.status==='error'?'RA · Falha na leitura':value?.status==='unsupported'?'RA · Formato não suportado':'RA · ISO não verificada'}
  </span>;
}
export function RADetails({value}:{value?:RACompatible}){
  const ok=value?.status==='compatible';
  return <section className={`raCompatibilityDetail ${ok?'verified':''}`}>
    <div className="raCompatibilityTitle">{ok?<ShieldCheck/>:<Info/>}<strong>{ok?'ISO compatível com conquistas':'Compatibilidade RetroAchievements'}</strong></div>
    <div className="raCompatibilityInfo">{ok&&value.image&&<img src={value.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<div><RABadge value={value}/><p>{ok?`${value.title} · ${value.count} conquistas ativas`:value?.message||'Baixe ou importe a ISO para verificar a versão exata.'}</p></div></div>
    {value?.fileName&&<small>Arquivo verificado: {value.fileName}</small>}
    {value?.hash&&<details><summary>Ver identificação da imagem</summary><code>{value.hash}</code></details>}
    {ok&&<p className="raCompatibilityCaution">OPL-RA: softcore experimental; limitações com SMB.</p>}
  </section>;
}
