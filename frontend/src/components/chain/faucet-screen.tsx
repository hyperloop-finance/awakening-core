"use client";

import Image from 'next/image';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';
import {usePublicClient, useSwitchChain, useWalletClient} from 'wagmi';
import {erc20Abi, formatUnits, type Hex} from 'viem';
import type {RuntimeConfig} from '@/lib/api/types';
import {faucetCalldata, faucetTokens} from '@/lib/contracts/faucet';
import {useWalletIdentity} from '@/components/shell/wallet';
import {walletError} from '@/components/shell/wallet-modal';
import {useChainWallet} from './use-chain-wallet';

function LinkArrow({external=false}:{external?:boolean}) {
  return <svg className="faucet-link-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={external?'M6 14 14 6M6 6h8v8':'M4 10h12M11 5l5 5-5 5'}/></svg>;
}

// Established-world extension: an asset ledger; existing purple/white typography.
export function FaucetScreen({config}: {config:RuntimeConfig}) {
  const {wallet, chainId, openWallet} = useWalletIdentity();
  return <FaucetSession key={`${wallet ?? 'disconnected'}:${chainId}`} config={config} openWallet={openWallet} wallet={wallet} chainId={chainId}/>;
}

function FaucetSession({config,openWallet,wallet,chainId}:{config:RuntimeConfig;openWallet:()=>void;wallet?:`0x${string}`;chainId?:number}) {
  const client = usePublicClient({chainId:97});
  const {switchChainAsync} = useSwitchChain();
  const {data:walletClient} = useWalletClient();
  const signing = useChainWallet(config);
  const [balances, setBalances] = useState<Record<string,string>>({});
  const [balanceError, setBalanceError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [adding, setAdding] = useState<string>();
  const [walletNotice, setWalletNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<{symbol:string;hash:Hex}>();
  const lock = useRef(false), alive = useRef(true), reads = useRef(0);
  useEffect(() => {
    const pendingReads=reads;
    alive.current=true;
    return () => {alive.current=false; pendingReads.current++;};
  }, []);
  const enabled = config.profile==='bsc-testnet' && config.chainId===97 && config.verificationStatus==='VERIFIED' && config.transactionsEnabled;
  const refresh = useCallback(async () => {
    if(!wallet || !client) return;
    const version = ++reads.current;
    setLoading(true); setBalanceError(false);
    try {
      const values = await Promise.all(faucetTokens.map(async token => {
        const balance = await client.readContract({address:token.address,abi:erc20Abi,functionName:'balanceOf',args:[wallet]});
        return [token.symbol, formatUnits(balance,token.decimals)];
      }));
      if(alive.current && reads.current===version) setBalances(Object.fromEntries(values));
    } catch {
      if(alive.current && reads.current===version) {setBalances({}); setBalanceError(true);}
    } finally {if(alive.current && reads.current===version) setLoading(false);}
  }, [wallet,client]);
  useEffect(() => {void refresh();}, [refresh]);

  async function addToWallet(token:typeof faucetTokens[number]) {
    if(!wallet) {openWallet(); return;}
    if(lock.current) return;
    lock.current=true;setAdding(token.symbol);setWalletNotice(undefined);
    try {
      if(chainId!==97) {
        await switchChainAsync({chainId:97});
        if(alive.current)setWalletNotice('Network switched. Click Add again to import the token.');
        return;
      }
      if(!walletClient) {setWalletNotice('Wallet is connecting. Try Add again in a moment.');return;}
      const [network,accounts]=await Promise.all([walletClient.getChainId(),walletClient.getAddresses()]);
      if(!alive.current)return;
      if(network!==97 || !accounts.some(account=>account.toLowerCase()===wallet.toLowerCase())) {
        setWalletNotice('Wallet changed. Select BNB Testnet and try again.');return;
      }
      const added=await walletClient.watchAsset({type:'ERC20',options:{address:token.address,symbol:token.onchainSymbol,decimals:token.decimals}});
      if(alive.current)setWalletNotice(added?`${token.onchainSymbol} added to your wallet.`:'Token was not added. You can try again when ready.');
    } catch(reason) {
      if(alive.current) {
        const value=reason as {code?:number;cause?:{code?:number}};
        const code=value?.cause?.code??value?.code;
        setWalletNotice(code===4200||code===-32601?'This wallet does not support token import. Use MetaMask, or copy the token address from its explorer link to import manually.':walletError(reason));
      }
    } finally {lock.current=false;if(alive.current)setAdding(undefined);}
  }

  async function claim(token:typeof faucetTokens[number]) {
    if(!wallet) {openWallet(); return;}
    if(lock.current) return;
    lock.current=true; setBusy(token.symbol); setError(undefined); setSuccess(undefined); signing.clearStatus();
    try {
      if(chainId!==97) {await switchChainAsync({chainId:97}); return;}
      if(!enabled) throw Error('Testnet transactions are unavailable.');
      const session = signing.session();
      const hash = await session.tx(token.address,faucetCalldata);
      session.check();
      if(alive.current) {setSuccess({symbol:token.symbol,hash}); await refresh();}
    } catch(reason) {
      if(alive.current) setError(walletError(reason));
    } finally {lock.current=false; if(alive.current) setBusy(undefined);}
  }
  const stage = signing.status?.stage;
  const pendingText = stage==='submitted' ? 'Confirming transaction…' : stage==='awaiting-signature' ? 'Confirm in your wallet…' : 'Preparing transaction…';

  return <section className="faucet-page" aria-labelledby="faucet-title">
    <header className="faucet-header">
      <div><h1 className="page-heading" id="faucet-title">A little fuel.<br/><span>A lot to explore.</span></h1>
        <p className="page-subtitle">Get test tokens, then try your first borrow or lend.</p></div>
    </header>
    <div className="faucet-toolbar"><h2>Choose your test tokens</h2>
      <button className="aw-refresh" aria-label="Refresh balances" aria-busy={loading} onClick={() => void refresh()} disabled={!wallet || loading}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></svg>Refresh</button></div>
    <div className="faucet-ledger" aria-label="Test token faucets">
      <div className="faucet-columns" aria-hidden="true"><span>Asset</span><span>Wallet balance</span><span>Per claim</span><span/></div>
      {faucetTokens.map(token => <article className="faucet-row" key={token.address} aria-label={`${token.symbol} faucet`}>
        <div className="faucet-asset"><span className={`faucet-logo${token.symbol==='bTesla'?' faucet-logo-tesla':token.symbol==='bNVIDIA'?' faucet-logo-nvidia':''}`}><Image src={token.logo} alt={token.name} width={40} height={40}/></span>
          <div><div className="faucet-asset-title"><h3>{token.symbol}</h3><button className="faucet-add" aria-label={`Add ${token.symbol} to wallet`} aria-busy={adding===token.symbol} title="Add token to wallet" disabled={Boolean(busy||adding)} onClick={()=>void addToWallet(token)}>{/* Lucide wallet-minimal; ISC notice in public/icons/LUCIDE-LICENSE.txt. */}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 14h.01"/><path d="M7 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14"/></svg></button></div><a href={`https://testnet.bscscan.com/address/${token.address}`} target="_blank" rel="noreferrer">{token.onchainSymbol} · {token.symbol.startsWith('b')?'Simulated stock':'Test token'} <LinkArrow external/></a></div></div>
        <div className="faucet-number"><span className="faucet-mobile-label">Wallet balance</span><strong>{balances[token.symbol]===undefined?'—':`${balances[token.symbol]} ${token.symbol}`}</strong></div>
        <div className="faucet-number"><span className="faucet-mobile-label">Per claim</span><strong>1,000 <span>{token.symbol}</span></strong></div>
        <button className="primary-button faucet-claim" disabled={Boolean(busy||adding) || Boolean(wallet && chainId===97 && !enabled)} onClick={() => void claim(token)} aria-label={!wallet?'Connect wallet':chainId!==97?'Switch to BNB Testnet':`Claim ${token.symbol}`}>
          {busy===token.symbol?'Processing…':!wallet?'Connect wallet':chainId!==97?'Switch network':'Claim tokens'}</button>
      </article>)}
    </div>
    <div className="faucet-feedback" hidden>
      {adding && <p role="status">Confirm token import in your wallet.</p>}
      {walletNotice && <p role="status">{walletNotice}</p>}
      {busy && <p role="status">{chainId!==97?'Confirm the network switch in your wallet.':pendingText}</p>}
      {success && <p role="status">1,000 {success.symbol} received successfully. <a href={`https://testnet.bscscan.com/tx/${success.hash}`} target="_blank" rel="noreferrer">View transaction</a></p>}
      {error && <p role="alert">{error}</p>}
      {!success && signing.status?.hash && <p><a href={`https://testnet.bscscan.com/tx/${signing.status.hash}`} target="_blank" rel="noreferrer">View submitted transaction</a> · A submitted transaction may still confirm; check its status before retrying.</p>}
      {balanceError && <p role="alert">Balances unavailable. Check your connection and refresh balances.</p>}
      {!enabled && <p>Testnet transactions are currently unavailable. Reload once the runtime is ready.</p>}
    </div>
    <footer className="faucet-footer"><Link href="/markets">Explore markets <LinkArrow/></Link></footer>
  </section>;
}
