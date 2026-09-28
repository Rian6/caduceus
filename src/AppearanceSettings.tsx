import {useState} from 'react';
import {Moon, Sun, Palette} from 'lucide-react';

export function AppearanceSettings() {
  const [theme,setTheme] = useState(document.documentElement.dataset.theme || 'dark');
  return <section className="settingsPanel appearancePanel">
    <div className="settingsTitle"><span className="statIcon"><Palette/></span><div><h2>Aparência</h2><p>Escolha o tema do aplicativo.</p></div></div>
    <div className="themeChoices" role="group" aria-label="Tema do aplicativo">
      {(['light','dark'] as const).map(value=><button key={value} aria-pressed={theme===value} onClick={()=>{
        document.documentElement.dataset.theme=value;setTheme(value);
        try {localStorage.setItem('ps2-library-theme',value)} catch {}
      }}>{value==='light'?<Sun/>:<Moon/>}{value==='light'?'Modo claro':'Modo escuro'}</button>)}
    </div>
  </section>;
}
