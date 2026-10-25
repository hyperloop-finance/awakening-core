"use client";
import {useEffect} from 'react';

export function ActionToast({message,error,onClose}:{message:string;error:boolean;onClose:()=>void}){
  useEffect(()=>{const timer=setTimeout(onClose,7000);return()=>clearTimeout(timer);},[message,onClose]);
  return <div className="aw-action-toast" role={error?'alert':'status'}>
    <span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={onClose}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
    </button>
  </div>;
}
