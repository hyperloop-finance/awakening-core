"use client";

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useAccount, useSwitchChain } from 'wagmi';
import { ACTIVE_CHAIN_ID, NETWORKS, isSupportedWalletChain } from '@/lib/networks';
import { walletError } from './wallet-modal';

function NetworkLogo({name}:{name:string}) {
  const file=name==='BNB'?'bnb.ico':name==='Robinhood'?'robinhood.ico':name==='Solana'?'solana.svg':`${name.toLowerCase()}.png`;
  return <Image className="network-logo" src={`/networks/${file}`} width={24} height={24} alt="" unoptimized/>;
}

export function NetworkSelector() {
  const {chainId,isConnected}=useAccount();
  const {switchChainAsync}=useSwitchChain();
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string>();
  const [environment,setEnvironment]=useState<'mainnet'|'testnet'>('testnet');
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const id=useId();
  const close=()=>{setOpen(false);trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    panel.current?.focus();
    const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);
  const supported=isSupportedWalletChain(chainId);
  // Presentation branding only; wallet chain validation still uses ACTIVE_CHAIN_ID.
  const label=isConnected&&!supported?'Unsupported network':'Arbitrum Testnet';
  const switchNetwork=async()=>{
    if(pending)return;
    setPending(true);setError(undefined);
    try{if(isConnected&&!supported)await switchChainAsync({chainId:ACTIVE_CHAIN_ID});close();}
    catch(reason){setError(walletError(reason));}
    finally{setPending(false);}
  };
  return <div className="network-picker" ref={root}
    onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}
    onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close();}}}>
    <button ref={trigger} className="wallet-button wallet-button-muted network-trigger" aria-label={`Select network: ${label}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{setError(undefined);setOpen(!open);}}>
      <NetworkLogo name="Arbitrum"/>{label}<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
    </button>
    {open&&<div ref={panel} id={id} className="network-popover" role="dialog" aria-label="Select network" tabIndex={-1}>
      <div className="network-list" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${environment}`}>
      {NETWORKS.filter(network=>network.environment===environment).map(network=><button key={network.key}
        className={`network-row${network.status==='enabled'&&(!isConnected||supported)?' network-row-selected':''}`}
        disabled={network.status==='coming-soon'||pending}
        aria-label={network.status==='enabled'&&isConnected&&!supported?'Switch to BNB Testnet':undefined}
        onClick={()=>void switchNetwork()}>
        <NetworkLogo name={network.label.split(' ')[0]}/><span className="network-row-label">{network.label}</span>
        {network.status==='coming-soon'?<small>Coming soon</small>:pending?<small>Check wallet…</small>:(!isConnected||supported)?
          <svg className="network-check" viewBox="0 0 20 20" width="18" height="18" aria-label="Selected"><path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>:null}
      </button>)}</div>
      <div className="network-tabs" role="tablist" aria-label="Network environment">
        {(['mainnet','testnet'] as const).map(value=><button key={value} id={`${id}-${value}`} role="tab"
          aria-selected={environment===value} aria-controls={`${id}-panel`} tabIndex={environment===value?0:-1}
          onClick={()=>setEnvironment(value)} onKeyDown={event=>{
            if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
              event.preventDefault();
              const next=event.key==='Home'?'mainnet':event.key==='End'?'testnet':value==='mainnet'?'testnet':'mainnet';
              setEnvironment(next);document.getElementById(`${id}-${next}`)?.focus();
            }
          }}>{value==='mainnet'?'Mainnets':'Testnets'}</button>)}
      </div>
      {error&&<p className="wallet-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
