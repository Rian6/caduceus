import {useEffect,useState,useRef} from 'react';
import {Trophy,X} from 'lucide-react';

export function AchievementNotifications(){
  const [queue,setQueue]=useState<XeraUnlock[]>([]);
  const context=useRef<AudioContext|null>(null);
  const chime=()=>{
    if(localStorage.getItem('achievement-sound')==='off')return;
    const volume=Math.max(0,Math.min(100,Number(localStorage.getItem('achievement-volume')||'50')))/100;
    const audio=context.current ||=new AudioContext();void audio.resume().then(()=>{
      [523.25,659.25,783.99].forEach((frequency,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+index*.12;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*.12,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+.65);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.7);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}});
    }).catch(()=>{});
  };
  useEffect(()=>{const off=window.games.onXeraUnlock(unlock=>setQueue(old=>[...old,unlock].slice(-20)));window.addEventListener('test-achievement-sound',chime);return()=>{off();window.removeEventListener('test-achievement-sound',chime);void context.current?.close();context.current=null}},[]);
  const current=queue[0];
  useEffect(()=>{if(!current)return;chime();window.dispatchEvent(new Event('achievement-unlocked'));const timer=setTimeout(()=>setQueue(old=>old.slice(1)),6500);return()=>clearTimeout(timer)},[current]);
  return current?<aside className="achievementToast" role="status"><Trophy/><div><small>CONQUISTA DESBLOQUEADA</small><b>{current.title}</b><span>{current.game} · {current.points} pontos</span></div><button className="iconButton" aria-label="Fechar conquista" onClick={()=>setQueue(old=>old.slice(1))}><X/></button></aside>:null;
}
