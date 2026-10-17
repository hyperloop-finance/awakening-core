"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { WalletDialog } from './wallet-dialog';
import { NetworkSelector } from './network-selector';
import { walletError } from './wallet-modal';

type WalletContextValue = {
  openWallet: () => void;
  pendingConnection?: string;
  connectionError?: string;
  connect: (name: string, action: () => Promise<unknown>) => Promise<void>;
};
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({children}:{children:ReactNode}) {
  const [open,setOpen]=useState(false);
  const [pendingConnection,setPendingConnection]=useState<string>();
  const [connectionError,setConnectionError]=useState<string>();
  const connecting=useRef(false);
  const openWallet=useCallback(()=>setOpen(true),[]);
  const close=useCallback(()=>setOpen(false),[]);
  const connect=useCallback(async(name:string,action:()=>Promise<unknown>)=>{
    if(connecting.current)return;
    connecting.current=true;
    setPendingConnection(name);setConnectionError(undefined);
    try { await action();setOpen(false); }
    catch(reason) { setConnectionError(walletError(reason)); }
    finally { connecting.current=false;setPendingConnection(undefined); }
  },[]);
  return <WalletContext.Provider value={{openWallet,pendingConnection,connectionError,connect}}>
    {children}
    {open && <WalletDialog onClose={close} />}
  </WalletContext.Provider>;
}

export function useWalletConnection() {
  const context=useContext(WalletContext);
  if(!context)throw new Error('WalletProvider is required');
  return context;
}

export function useWalletIdentity() {
  const account=useAccount();
  const context=useContext(WalletContext);
  if (!context) throw new Error('WalletProvider is required');
  return {wallet:account.isConnected?account.address:undefined,chainId:account.chainId,openWallet:context.openWallet};
}

export function WalletControls() {
  const {wallet,openWallet}=useWalletIdentity();
  return <div className="wallet-controls">
    <NetworkSelector />
    <button className="wallet-button" aria-label={wallet?'Manage wallet':'Connect wallet'} onClick={openWallet}>
      {wallet?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:'Connect wallet'}
    </button>
  </div>;
}
