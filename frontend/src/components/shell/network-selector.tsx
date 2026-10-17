"use client";

import { useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { ACTIVE_CHAIN_ID, NETWORKS, isSupportedWalletChain } from '@/lib/networks';
import { WalletModal, walletError } from './wallet-modal';

export function NetworkSelector() {
  const {chainId,isConnected}=useAccount();
  const {switchChainAsync}=useSwitchChain();
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string>();
  const supported=isSupportedWalletChain(chainId);
  const label=isConnected&&!supported?'Unsupported network':'BNB Testnet';
  const switchNetwork=async()=>{
    if(pending)return;
    setPending(true);setError(undefined);
    try{if(isConnected&&!supported)await switchChainAsync({chainId:ACTIVE_CHAIN_ID});setOpen(false);}
    catch(reason){setError(walletError(reason));}
    finally{setPending(false);}
  };
  return <>
    <button className="wallet-button wallet-button-muted network-trigger" aria-label={`Select network: ${label}`} onClick={()=>{setError(undefined);setOpen(true);}}>
      {label}<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
    </button>
    {open&&<WalletModal title="Select network" onClose={()=>setOpen(false)}>
      <p className="wallet-help">BNB Testnet supports test-asset transactions when the deployed contracts are verified. Other networks are coming soon.</p>
      <div className="network-options">{NETWORKS.map(network=><button key={network.key} className="wallet-option" disabled={network.status==='coming-soon'||pending}
        aria-label={network.status==='enabled'&&isConnected&&!supported?'Switch to BNB Testnet':undefined}
        onClick={()=>void switchNetwork()}>
        <span>{network.label}</span><small>{network.status==='coming-soon'?'Coming soon':pending?'Check wallet…':supported?'Connected':'Test network'}</small>
      </button>)}</div>
      {error&&<p className="wallet-error" role="alert">{error}</p>}
    </WalletModal>}
  </>;
}
