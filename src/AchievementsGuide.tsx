import {useState} from 'react';
import {BookOpen,KeyRound,Gamepad2,Volume2,ArrowRight,ArrowLeft} from 'lucide-react';
import {Modal} from './ui';

const storageKey='caduceus-achievements-guide-v1';
export function needsAchievementsGuide(){try{return localStorage.getItem(storageKey)!=='seen'}catch{return true}}
export function AchievementsGuide({onClose}:{onClose:()=>void}){
  const [step,setStep]=useState(0);
  const close=()=>{try{localStorage.setItem(storageKey,'seen')}catch{}onClose()};
  const cards=[
    {icon:KeyRound,title:'Conecte uma vez',text:'Informe usuário, senha e Web API Key no formulário do Caduceus. A mesma conexão habilita a biblioteca e as conquistas ao vivo, sem abrir outra janela.',note:'A Web API Key está em retroachievements.org/settings. A senha não é salva; o token da conta e a chave ficam protegidos pelo Windows.'},
    {icon:Gamepad2,title:'Conecte o PS2',text:'O componente inicia em segundo plano. Acompanhe a conta, o console e o jogo atual no painel acima da biblioteca. Em “Som e configuração do PS2”, você encontra os controles e o ELF.',note:'Salve o OPL-RA.ELF, transfira para o PS2 e execute “RA: test PC connection” e “RA: check game support” antes de jogar. OPLServer continua ativo.'},
    {icon:Volume2,title:'Receba os desbloqueios',text:'Novas conquistas recebidas aparecem como notificações no Caduceus, mesmo em outras abas. Você pode ajustar o volume, testar o som ou silenciá-lo.',note:'O modo ao vivo é experimental e apenas softcore. Conquistas com jogos via SMB podem interromper o carregamento: teste por USB ou disco compatível. Para jogar pela rede, continue usando o OPL normal.'}
  ];
  const card=cards[step],Icon=card.icon;
  return <Modal title="Como funcionam as conquistas" onClose={close} className="achievementGuide">
    <div className="tutorialHeader"><span><BookOpen/>GUIA DE CONQUISTAS</span><span>{step+1} / {cards.length}</span></div>
    <div className="achievementGuideIcon"><Icon/></div>
    <h2>{card.title}</h2><p>{card.text}</p><div className="tutorialNote">{card.note}</div>
    <nav className="tutorialSteps" aria-label="Etapas do guia de conquistas">{cards.map((item,index)=><button key={item.title} aria-label={item.title} aria-current={index===step?'step':undefined} onClick={()=>setStep(index)}/>)}</nav>
    <footer className="tutorialFooter"><button className="textButton" onClick={close}>Ver depois</button><div><button disabled={step===0} onClick={()=>setStep(step-1)}><ArrowLeft/>Voltar</button><button className="primary" onClick={()=>step===cards.length-1?close():setStep(step+1)}>{step===cards.length-1?'Entendi':'Próximo'}<ArrowRight/></button></div></footer>
    <small className="achievementGuideHint">Você pode reabrir este guia em “Como funciona” nesta aba.</small>
  </Modal>;
}
