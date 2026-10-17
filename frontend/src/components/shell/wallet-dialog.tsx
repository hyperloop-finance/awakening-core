"use client";

import { useEffect, useRef, useState } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { formatUnits } from 'viem';
import { ACTIVE_CHAIN_ID, isSupportedWalletChain } from '@/lib/networks';
import { WalletModal, walletError } from './wallet-modal';
import { useWalletConnection } from './wallet';

export function WalletDialog({onClose}:{onClose:()=>void}) {
  const {address,chainId,isConnected}=useAccount();
  return <WalletModal title={isConnected?'Your wallet':'Connect wallet'} onClose={onClose}>
    <WalletContent key={`${address??'disconnected'}:${chainId}`} onClose={onClose}/>
  </WalletModal>;
}

function WalletContent({onClose}:{onClose:()=>void}) {
  const {address,chainId,isConnected}=useAccount();
  const {connectors,connectAsync}=useConnect();
  const connection=useWalletConnection();
  const {disconnectAsync}=useDisconnect();
  const {switchChainAsync}=useSwitchChain();
  const supported=isSupportedWalletChain(chainId);
  const balance=useBalance({address,chainId:ACTIVE_CHAIN_ID,query:{enabled:!!address&&supported,retry:1}});
  const [available,setAvailable]=useState<Connector[]>([]);
  const [discovering,setDiscovering]=useState(true);
  const [pending,setPending]=useState<string>();
  const [error,setError]=useState<string>();
  const [copied,setCopied]=useState(false);
  const busy=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    const deadline=(connector:Connector)=>new Promise<boolean>(resolve=>{
      const timer=setTimeout(()=>resolve(false),1500);
      connector.getProvider().then(provider=>resolve(!!provider)).catch(()=>resolve(false)).finally(()=>clearTimeout(timer));
    });
    Promise.all(connectors.map(async connector=>({connector,ready:connector.type!=='injected'||await deadline(connector)})))
      .then(results=>{if(active){const ready=results.filter(r=>r.ready).map(r=>r.connector);setAvailable(ready.filter(c=>c.id!=='injected'||!ready.some(other=>other.id!=='injected'&&other.type==='injected')));setDiscovering(false);}});
    return()=>{active=false;};
  },[connectors]);

  const perform=async(label:string,action:()=>Promise<unknown>,close=false)=>{
    if(busy.current)return;
    busy.current=true;setPending(label);setError(undefined);
    try{await action();if(mounted.current&&close)onClose();}
    catch(reason){if(mounted.current)setError(walletError(reason));}
    finally{busy.current=false;if(mounted.current)setPending(undefined);}
  };

  if(!isConnected || !address)return <>
    <p className="wallet-help">Choose your wallet. Connecting does not authorize a transaction or give Hyperloop access to your funds.</p>
    <div className="wallet-options">{available.map(connector=><button className="wallet-option" key={connector.uid} aria-label={connector.name==='Injected'?'Browser wallet':connector.name} disabled={!!connection.pendingConnection}
      onClick={()=>void connection.connect(connector.name,()=>connectAsync({connector}))}>
      <span>{connector.name==='Injected'?'Browser wallet':connector.name}</span><small>{connection.pendingConnection===connector.name?'Check wallet…':connector.type==='walletConnect'?'QR / Mobile':'Detected'}</small>
    </button>)}</div>
    {discovering?<p className="wallet-help" role="status">Looking for wallets…</p>:!available.length&&<p className="wallet-help">No browser wallet detected. Install MetaMask or Rabby, then reload this page.</p>}
    {!!connection.pendingConnection&&<p className="wallet-help" role="status">Approve the connection in your wallet. No signature is requested.</p>}
    {connection.connectionError&&<p className="wallet-error" role="alert">{connection.connectionError}</p>}
    <p className="wallet-footnote">BNB Testnet · Test assets only</p>
  </>;

  return <>
    <p className="wallet-address">{address}</p>
    <dl className="wallet-details"><div><dt>Network</dt><dd>{supported?'BNB Testnet':`Unsupported network (${chainId??'unknown'})`}</dd></div>
      <div><dt>Balance</dt><dd>{!supported?'Switch network to view':balance.isError?'Balance unavailable':balance.isPending?'Loading…':balance.data?`${formatUnits(balance.data.value,balance.data.decimals)} tBNB`:'Balance unavailable'}</dd></div>
    </dl>
    {!supported&&<button className="wallet-option" disabled={!!pending} onClick={()=>void perform('switch',()=>switchChainAsync({chainId:ACTIVE_CHAIN_ID}))}>Switch to BNB Testnet</button>}
    <div className="wallet-options">
      <button className="wallet-option" onClick={async()=>{try{await navigator.clipboard.writeText(address);setCopied(true);}catch{setError('Could not copy. Select and copy the address above.');}}}>{copied?'Address copied':'Copy address'}</button>
      {supported&&<a className="wallet-option" href={`https://testnet.bscscan.com/address/${address}`} target="_blank" rel="noopener noreferrer">View in explorer</a>}
      <button className="wallet-option" disabled={!!pending} onClick={()=>void perform('disconnect',()=>disconnectAsync(),true)}>Disconnect</button>
    </div>
    {pending&&<p role="status" className="wallet-help">Check your wallet…</p>}
    {error&&<p role="alert" className="wallet-error">{error}</p>}
    <p className="wallet-footnote">Wallet connected. Protocol transactions are not live yet.</p>
  </>;
}
