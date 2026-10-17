"use client";
import {FaucetScreen} from '@/components/chain/faucet-screen';
import {useRuntimeReadiness} from '@/components/shell/app-shell';
export default function FaucetPage() {
  const runtime=useRuntimeReadiness();
  return runtime.kind==='ready'?<FaucetScreen config={runtime.config}/>:null;
}
