"use client";

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { NetworkSelector } from './network-selector';

type WalletContextValue = {
  openWallet: () => void;
};
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({children}:{children:ReactNode}) {
  const {isConnected}=useAccount();
  const {openConnectModal}=useConnectModal();
  const {openAccountModal}=useAccountModal();
  const openWallet=useCallback(()=>{
    if(isConnected)openAccountModal?.();
    else openConnectModal?.();
  },[isConnected,openAccountModal,openConnectModal]);
  return <WalletContext.Provider value={{openWallet}}>
    {children}
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
