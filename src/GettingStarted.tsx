import {useState} from 'react';
import {Gamepad2, Cable, Monitor, Router, Library, CheckCircle2, ArrowRight, ArrowLeft, BookOpen} from 'lucide-react';
import {Modal} from './ui';

const key='ps2-library-tutorial-v1';
export function needsTutorial(){try{return localStorage.getItem(key)!=='done'}catch{return true}}
export function GettingStarted({status,onClose}:{status:OplStatus|null;onClose:()=>void}) {
  const [step,setStep]=useState(0);
  const finish=()=>{try{localStorage.setItem(key,'done')}catch{}onClose()};
  const cards=[
    {icon:Gamepad2,label:'PREPARAÇÃO',title:'Prepare o seu PlayStation 2',text:'Este aplicativo fica no computador. No console, você precisa do Open PS2 Loader (OPL) para abrir jogos pela rede.',items:['Use um método de homebrew compatível com seu modelo, como Free McBoot nos modelos suportados, para executar arquivos ELF.','Baixe o OPL no projeto oficial, extraia o arquivo ELF e transfira por um pendrive compatível com o console. Pelo gerenciador de arquivos do PS2, execute o ELF ou copie-o para o memory card e configure um atalho no seu inicializador.','O procedimento de instalação do inicializador varia por modelo. Este aplicativo não instala o OPL no PS2.'],note:'Já usa o OPL? Avance para a conexão de rede.'},
    {icon:Cable,label:'CONEXÃO',title:'Conecte o cabo de rede',text:'O caminho mais simples é conectar o PS2 e o computador ao mesmo roteador.',items:['Ligue um cabo Ethernet da porta de rede do PS2 a uma porta LAN do roteador. Prefira conectar o computador por cabo também.','No PS2 Fat, é necessário um adaptador de rede com Ethernet; adaptadores apenas SATA não oferecem essa conexão.','Para ligar PS2 e PC diretamente, configure IPs estáticos diferentes na mesma sub-rede. Sem roteador ou servidor DHCP, a configuração automática não funciona.'],note:'Mantenha o computador ligado e sem suspensão enquanto estiver jogando.'},
    {icon:Monitor,label:'NO COMPUTADOR',title:'Confira o servidor do aplicativo',text:'Abra Configurações → Conexão com o PS2. Os dados abaixo acompanham a configuração atual do aplicativo.',items:['Espere o indicador do servidor ficar online.','Use o IP da interface conectada à mesma rede do console; se houver mais de um, confira a seleção em Configurações.','Se o Windows solicitar permissão de rede para o OPLServer, permita na sua rede privada.'],note:'Anote o IP, a porta e o compartilhamento para a próxima etapa.'},
    {icon:Router,label:'NO PLAYSTATION 2',title:'Configure a rede no OPL',text:'No OPL, pressione START e abra Network config (Configuração de rede). Os nomes podem variar conforme a versão.',items:['Na seção PS2, use DHCP se estiver conectado a um roteador com DHCP ativo. O IP do PS2 deve ser diferente do IP do computador.','Na seção SMB Server, selecione endereço por IP e preencha o IP do computador, a porta exibida aqui e o compartilhamento PS2.','Para o servidor incluído neste aplicativo, use o usuário Guest e deixe a senha vazia. Confirme em OK.'],note:'Use a porta configurada neste aplicativo; não copie automaticamente a porta padrão 445 de outros tutoriais.'},
    {icon:Library,label:'SUA BIBLIOTECA',title:'Adicione os jogos ao computador',text:'O catálogo reúne informações dos jogos. Para jogar, o arquivo do jogo também precisa estar instalado.',items:['Na Biblioteca, use Baixar jogo quando houver um link disponível e aguarde a conclusão em Downloads.','Para uma ISO que já está no computador, abra a edição do jogo e use a opção de importar ISO. Confira o resultado em Instalados.','Em Configurações, você pode escolher o local da pasta OPL Server, importar um catálogo e salvar um backup da base.'],note:'Importar uma base SQLite ou JSON não transfere ISOs. O backup do catálogo também não inclui os arquivos dos jogos.'},
    {icon:CheckCircle2,label:'PRONTO PARA JOGAR',title:'Abra a lista de jogos por rede',text:'No OPL, entre em Settings e ative ETH device start mode (ou a opção equivalente de jogos por rede) em Auto. Salve as alterações em Save changes.',items:['Abra a lista ETH / Network Games e atualize a lista se necessário. Selecione um jogo instalado para iniciar.','Se a lista estiver vazia, confira o cabo, o servidor online, o IP, a porta, o compartilhamento e se a ISO terminou de ser instalada.','Mantenha o aplicativo e o servidor abertos durante a partida. Se o IP do computador mudar, atualize o endereço no OPL.'],note:'Você pode rever este guia em Configurações → Primeiros passos.'}
  ];
  const card=cards[step],Icon=card.icon;
  return <Modal title="Primeiros passos" onClose={finish} className="tutorialModal">
    <div className="tutorialHeader"><span><BookOpen/>GUIA DE CONFIGURAÇÃO</span><span>{step+1} / {cards.length}</span></div>
    <div className="tutorialLayout">
      <aside className="tutorialArt" aria-hidden="true"><div className="tutorialHalo"><Icon/></div><div className="tutorialWire"><Monitor/><i/><Router/><i/><Gamepad2/></div><span>COMPUTADOR · REDE · PS2</span></aside>
      <article className="tutorialCard" key={step}><span className="eyebrow">{card.label}</span><h2>{card.title}</h2><p>{card.text}</p>
        {(step===2||step===3)&&<dl className="tutorialConnection"><div><dt>IP do computador</dt><dd>{status?.ip&&status.ip!=='127.0.0.1'?status.ip:'Confira em Configurações'}</dd></div><div><dt>Porta</dt><dd>{status?.port??'Aguardando'}</dd></div><div><dt>Compartilhamento</dt><dd>{status?.shareName||'PS2'}</dd></div></dl>}
        <ol>{card.items.map(item=><li key={item}>{item}</li>)}</ol><div className="tutorialNote">{card.note}</div>
        {step===0&&<p className="tutorialSource">Projeto oficial: <a href="https://github.com/ps2homebrew/Open-PS2-Loader/releases" target="_blank" rel="noreferrer">OPL e downloads</a></p>}
      </article>
    </div>
    <nav className="tutorialSteps" aria-label="Etapas do tutorial">{cards.map((item,index)=><button key={item.label} aria-label={`Etapa ${index+1}: ${item.title}`} aria-current={index===step?'step':undefined} onClick={()=>setStep(index)}/>)}</nav>
    <footer className="tutorialFooter"><button className="textButton" onClick={finish}>Ver depois</button><div><button disabled={step===0} onClick={()=>setStep(step-1)}><ArrowLeft/>Voltar</button><button className="primary" onClick={()=>step===cards.length-1?finish():setStep(step+1)}>{step===cards.length-1?'Começar a usar':'Próximo'}<ArrowRight/></button></div></footer>
  </Modal>;
}
