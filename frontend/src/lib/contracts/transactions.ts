import {parseUnits,type Hex} from 'viem';
export type TransactionStage='simulating'|'awaiting-signature'|'submitted'|'confirmed'|'indexing';
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
  if(input.chainId!==97)throw Error('Switch your wallet to BNB Testnet.');
  const check=()=>assertWalletIdentity(input.identity,input.current);
  check();input.stage('simulating');await input.simulate();check();
  input.stage('awaiting-signature');const hash=await input.write();check();
  input.stage('submitted',hash);const receipt=await input.receipt(hash);check();
  if(receipt.status!=='success')throw Error('Transaction reverted. No successful action was recorded.');
  input.stage('confirmed',hash);input.stage('indexing',hash);return hash;
}
