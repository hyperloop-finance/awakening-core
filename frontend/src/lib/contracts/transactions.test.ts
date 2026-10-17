import {it,expect} from 'vitest';
import {executeWalletTransaction,parseTokenAmount,repaymentAmount,availablePayout} from './transactions';
const hash=`0x${'1'.repeat(64)}` as const;
it('allows available partial lender payouts and disables absent liquidity',()=>{
  expect(availablePayout('100000000','25000000')).toBe('25000000');
  expect(availablePayout('100000000','200000000')).toBe('100000000');
  expect(availablePayout('100000000',undefined)).toBe('0');
  expect(availablePayout('100000000','0')).toBe('0');
});
it('bounds partial repayments by indexed remaining debt without number rounding',()=>{
  expect(repaymentAmount('25','100000000')).toBe(25000000n);
  expect(repaymentAmount('','100000000')).toBe(100000000n);
  expect(()=>repaymentAmount('101','100000000')).toThrow('remaining debt');
  expect(()=>repaymentAmount('0','100000000')).toThrow();
});
it('rejects wrong chain and invalid precision before asking the wallet',async()=>{
  let writes=0;
  await expect(executeWalletTransaction({chainId:56,identity:'a',current:()=> 'a',simulate:async()=>{},write:async()=>{writes++;return hash},receipt:async()=>({status:'success'}),stage:()=>{}})).rejects.toThrow();
  expect(writes).toBe(0);
  expect(()=>parseTokenAmount('0.0000001',6)).toThrow();
  expect(parseTokenAmount('9007199254.740993',6)).toBe(9007199254740993n);
});
it('never broadcasts after the account changes during simulation',async()=>{
  let identity='a:1',writes=0;
  await expect(executeWalletTransaction({chainId:97,identity,current:()=>identity,simulate:async()=>{identity='b:2'},write:async()=>{writes++;return hash},receipt:async()=>({status:'success'}),stage:()=>{}})).rejects.toThrow('Wallet changed');
  expect(writes).toBe(0);
});
it('rejects a reverted receipt and only marks indexing after successful confirmation',async()=>{
  const stages:string[]=[];
  const base={chainId:97,identity:'a',current:()=> 'a',simulate:async()=>{},write:async()=>hash,stage:(s:string)=>{stages.push(s)}};
  await expect(executeWalletTransaction({...base,receipt:async()=>({status:'reverted'})})).rejects.toThrow('reverted');
  expect(stages).not.toContain('indexing');stages.length=0;
  await executeWalletTransaction({...base,receipt:async()=>({status:'success'})});
  expect(stages).toEqual(['simulating','awaiting-signature','submitted','confirmed','indexing']);
});
it('does not report another wallet as confirmed after signing',async()=>{
  let identity='a'; const stages:string[]=[];
  await expect(executeWalletTransaction({chainId:97,identity,current:()=>identity,simulate:async()=>{},write:async()=>{identity='b';return hash},receipt:async()=>({status:'success'}),stage:s=>{stages.push(s)}})).rejects.toThrow('Wallet changed');
  expect(stages).not.toContain('confirmed');
});
it('a rejected approval is not treated as a submitted transaction',async()=>{
  const stages:string[]=[];
  await expect(executeWalletTransaction({chainId:97,identity:'a',current:()=> 'a',simulate:async()=>{},write:async()=>{throw Error('User rejected request')},receipt:async()=>({status:'success'}),stage:s=>{stages.push(s)}})).rejects.toThrow('rejected');
  expect(stages).not.toContain('submitted');
});
