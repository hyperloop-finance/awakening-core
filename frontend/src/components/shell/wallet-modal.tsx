"use client";

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function WalletModal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLElement>(null);
  const titleId=useId();
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';ref.current?.focus();
    return ()=>{document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return createPortal(<div className="wallet-overlay" onClick={e=>{if(e.target===e.currentTarget) onClose();}}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="wallet-dialog"
      onKeyDown={e=>{
        if(e.key==='Escape'){e.stopPropagation();onClose();}
        if(e.key==='Tab'){
          const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')??[]);
          const first=nodes[0],last=nodes.at(-1);
          if(!first){e.preventDefault();return;}
          if(e.shiftKey && (document.activeElement===first || document.activeElement===ref.current)){e.preventDefault();last?.focus();}
          else if(!e.shiftKey && (document.activeElement===last || document.activeElement===ref.current)){e.preventDefault();first.focus();}
        }
      }}>
      <header className="wallet-dialog-header"><h2 id={titleId}>{title}</h2><button className="wallet-close" aria-label="Close" onClick={onClose}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button></header>
      {children}
    </section>
  </div>,document.body);
}

export function walletError(error:unknown) {
  const value=error as {code?:number;name?:string;message?:string;cause?:{code?:number}};
  if(value?.code===4001 || value?.cause?.code===4001 || /reject|denied|cancel/i.test(`${value?.name} ${value?.message}`))
    return 'Request rejected. You can try again when ready.';
  return 'Wallet request failed. Check your wallet and connection, then try again.';
}
