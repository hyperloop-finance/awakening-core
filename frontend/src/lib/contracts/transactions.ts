import {ACTIVE_CHAIN_ID, ACTIVE_CHAIN_LABEL} from '@/lib/networks';
import {parseUnits,type Hex} from 'viem';
export type TransactionStage='simulating'|'awaiting-signature'|'submitted'|'confirmed'|'indexing';
export function actionErrorMessage(error:unknown):string {
  let current=error;
  const visited=new Set<unknown>();
  for(let depth=0;current&&typeof current==='object'&&depth<8&&!visited.has(current);depth++){
    visited.add(current);
    const value=current as {code?:number;name?:string;message?:string;cause?:unknown};
    if(value.code===4001||/reject|denied|cancelled|canceled/i.test(`${value.name??''} ${value.message??''}`))
      return 'Request cancelled in your wallet.';
    current=value.cause;
  }
  if(!error||typeof error!=='object')return 'Unable to complete this action. Please retry.';
  const value=error as {shortMessage?:string;message?:string};
  const text=value.shortMessage??value.message??'';
  const message=text.split(/\n|Request Arguments:|Details:|Version:|Docs:/)[0].trim();
  return message&&message.length<=240?message:'Transaction failed. Check your wallet and try again.';
}
export function parseTokenAmount(value:string,decimals:number):bigint {
  if(!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)||value.length>80||(value.split('.')[1]?.length??0)>decimals)
    throw Error(`Use a positive amount with at most ${decimals} decimal places.`);
  const amount=parseUnits(value,decimals);
  if(amount<=0n||amount>=2n**128n)throw Error('Amount is outside the supported range.');
  return amount;
}
export function assertWalletIdentity(identity:string,current:()=>string) {
  if(identity!==current())throw Error('Wallet changed. Review the action again; any already submitted transaction remains on-chain.');
}
export function repaymentAmount(value:string,remaining:string):bigint {
  const amount=value.trim()===''?BigInt(remaining):parseTokenAmount(value,6);
  if(amount<=0n||amount>BigInt(remaining))throw Error('Repayment must not exceed remaining debt.');
  return amount;
}
export function availablePayout(credit:string,withdrawable:string|undefined):string {
  const balance=BigInt(credit),available=BigInt(withdrawable??'0');
  return (balance<available?balance:available).toString();
}
export async function executeWalletTransaction(input:{
  chainId:number;identity:string;current:()=>string;simulate:()=>Promise<unknown>;
  write:()=>Promise<Hex>;receipt:(hash:Hex)=>Promise<{status:string}>;
  stage:(stage:TransactionStage,hash?:Hex)=>void;
}):Promise<Hex> {
  if(input.chainId!==ACTIVE_CHAIN_ID)throw Error(`Switch your wallet to ${ACTIVE_CHAIN_LABEL}.`);
  const check=()=>assertWalletIdentity(input.identity,input.current);
  check();input.stage('simulating');await input.simulate();check();
  input.stage('awaiting-signature');const hash=await input.write();check();
  input.stage('submitted',hash);const receipt=await input.receipt(hash);check();
  if(receipt.status!=='success')throw Error('Transaction reverted. No successful action was recorded.');
  input.stage('confirmed',hash);input.stage('indexing',hash);return hash;
}
