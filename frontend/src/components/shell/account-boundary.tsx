"use client";
import {ACTIVE_CHAIN_LABEL, ACTIVE_PROFILE} from '@/lib/networks';

import { Fragment, type ReactNode } from 'react';
import { useWalletIdentity } from './wallet';
import { EmptyState } from './states';
import type {RuntimeConfig} from '@/lib/api/types';
import {ChainWorkspace} from '@/components/chain/chain-workspace';

const accountPages:Record<string,string>={orders:'Orders',positions:'Positions',settlement:'Settlement',portfolio:'Positions'};

export function AccountBoundary({pathname,children,config}:{pathname:string;children:ReactNode;config?:RuntimeConfig}) {
  const {wallet,chainId,openWallet}=useWalletIdentity();
  const title=accountPages[pathname.split('/')[1]];
  if(pathname==='/faucet')return <>{children}</>;
  if(config?.profile===ACTIVE_PROFILE)return <ChainWorkspace key={`${wallet??'disconnected'}:${chainId??'none'}:${pathname}`} pathname={pathname} config={config}/>;
  // Do not mount mock-backed account components while live integration is absent.
  // The next integration phase replaces this boundary with verified chain queries.
  if(title)return <>
    <header className="portfolio-hero"><h1 className="page-heading">{title}</h1><p className="page-subtitle">Your {ACTIVE_CHAIN_LABEL} account activity will appear here once the protocol integration is ready.</p></header>
    {!wallet?<EmptyState title={`Connect a wallet to view ${title.toLowerCase()}`}><button className="inline-button" onClick={openWallet}>Connect wallet</button></EmptyState>
      :<EmptyState title="Testnet integration not ready">Your wallet is connected. No simulated positions, orders or settlements are shown as on-chain activity. Transactions remain disabled.</EmptyState>}
  </>;
  return <Fragment key={`${wallet??'disconnected'}:${chainId??'none'}`}>{children}</Fragment>;
}
