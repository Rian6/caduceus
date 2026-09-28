import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Disc3, X} from 'lucide-react';

export const bytes = (n: number) => !n ? '0 MB' : n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${(n / 1048576).toFixed(0)} MB`;
export const isDownloading = (state?: DownloadState) => !!state && ['starting', 'progressing', 'processing'].includes(state.state);
export const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);

export function Cover({src, title, className = ''}: {src?: string | null; title: string; className?: string}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`coverImage ${className}`}>
    {src && !failed ? <img src={src} alt={`Capa de ${title}`} loading="lazy" onError={() => setFailed(true)}/> :
      <div className="coverFallback"><Disc3/><span>PLAYSTATION 2</span><b>{title || 'Sem capa'}</b></div>}
  </div>;
}

export function Modal({title, onClose, children, className = ''}: {title: string; onClose: () => void; children: ReactNode; className?: string}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="modalBack" onMouseDown={event => {if (event.target === event.currentTarget) close.current();}}>
    <div ref={ref} className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])].filter(el => el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <button className="iconButton dialogClose" aria-label="Fechar" title="Fechar" onClick={onClose}><X/></button>
      {children}
    </div>
  </div>;
}
