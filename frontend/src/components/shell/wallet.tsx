"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { WalletDialog } from './wallet-dialog';
import { NetworkSelector } from './network-selector';

const WalletContext = createContext<{openWallet:()=>void} | undefined>(undefined);

export function WalletProvider({children}:{children:ReactNode}) {
  const [open,setOpen]=useState(false);
  const openWallet=useCallback(()=>setOpen(true),[]);
  const close=useCallback(()=>setOpen(false),[]);
  return <WalletContext.Provider value={{openWallet}}>
    {children}
    {open && <WalletDialog onClose={close} />}
  </WalletContext.Provider>;
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
