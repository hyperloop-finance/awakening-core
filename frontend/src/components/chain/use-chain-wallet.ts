"use client";
import {useEffect,useRef,useState} from 'react';
import {useAccount,usePublicClient,useWalletClient} from 'wagmi';
import {encodeFunctionData,erc20Abi,type Address,type Hex} from 'viem';
import {bscTestnet} from 'viem/chains';
import {deployment} from '@/lib/contracts/generated';
import {isTrustedFaucetCall} from '@/lib/contracts/faucet';
import {assertTrustedRuntime} from '@/lib/contracts/live-model';
import {offerTypedData,type ChainOffer} from '@/lib/contracts/offer-tree';
import {assertWalletIdentity,executeWalletTransaction,type TransactionStage} from '@/lib/contracts/transactions';
import type {RuntimeConfig} from '@/lib/api/types';

export function useChainWallet(config:RuntimeConfig) {
  const {address,chainId}=useAccount();
  const publicClient=usePublicClient({chainId:97});
  const {data:walletClient}=useWalletClient();
  const last=useRef(''),epoch=useRef(0),identity=useRef('');
  const key=`${address??''}:${chainId??''}`;
  if(last.current!==key){last.current=key;epoch.current++;}
  identity.current=`${key}:${epoch.current}`;
  useEffect(()=>{
    identity.current=`${last.current}:${++epoch.current}`;
    return()=>{identity.current='unmounted';};
  },[key]);
  const [status,setStatus]=useState<{stage:TransactionStage;hash?:Hex}>();
  function session() {
    assertTrustedRuntime(config);
    if(!config.transactionsEnabled)throw Error('Transactions are not enabled until testnet acceptance is complete.');
    if(!address||chainId!==97||!walletClient||!publicClient)throw Error('Connect your wallet on BNB Testnet.');
    const account=address,captured=identity.current;
    const check=()=>assertWalletIdentity(captured,()=>identity.current);
    const verifyWallet=async()=>{
      check();const [network,accounts]=await Promise.all([walletClient.getChainId(),walletClient.getAddresses()]);check();
      if(network!==97||!accounts.some(a=>a.toLowerCase()===account.toLowerCase()))throw Error('Wallet network or account changed.');
    };
    async function tx(to:Address,data:Hex) {
      if(!Object.values(deployment.contracts).some(a=>a.toLowerCase()===to.toLowerCase())&&!isTrustedFaucetCall(to,data))throw Error('Untrusted transaction target');
      await verifyWallet();
      return executeWalletTransaction({chainId:97,identity:captured,current:()=>identity.current,
        simulate:()=>publicClient!.call({account,to,data}),
        write:async()=>{await verifyWallet();return walletClient!.sendTransaction({account,chain:bscTestnet,to,data,value:0n});},
        receipt:hash=>publicClient!.waitForTransactionReceipt({hash,confirmations:1,timeout:120000}),
        stage:(stage,hash)=>{check();setStatus({stage,hash});},
      });
    }
    async function approve(token:Address,amount:bigint) {
      check();
      const spender=deployment.contracts.Awakening;
      const allowance=await publicClient!.readContract({address:token,abi:erc20Abi,functionName:'allowance',args:[account,spender]});check();
      if(allowance>=amount)return;
      if(allowance>0n)await tx(token,encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[spender,0n]}));
      await tx(token,encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[spender,amount]}));
    }
    async function sign(offer:ChainOffer) {
      await verifyWallet();setStatus({stage:'awaiting-signature'});
      const signature=await walletClient!.signTypedData({account,...offerTypedData(offer)});check();return signature;
    }
    return {account,check,tx,approve,sign,publicClient};
  }
  return {session,status,clearStatus:()=>setStatus(undefined)};
}
