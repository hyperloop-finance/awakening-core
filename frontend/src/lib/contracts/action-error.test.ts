import {it,expect} from 'vitest';
import {actionErrorMessage} from './transactions';
it('turns a verbose viem rejection into a short message without transaction arguments',()=>{
  const error=new Error('User rejected the request.\nRequest Arguments: chain: BNB Smart Chain Testnet from: 0x123 data: 0xbb1f12aa\nDetails: User denied transaction signature.\nVersion: viem@2.55.10');
  expect(actionErrorMessage(error)).toBe('Request cancelled in your wallet.');
  expect(actionErrorMessage({cause:{cause:{code:4001}}})).toBe('Request cancelled in your wallet.');
});
it('preserves useful business errors and removes developer details',()=>{
  expect(actionErrorMessage(Error('Order preview expired. Close it and review a new order.'))).toBe('Order preview expired. Close it and review a new order.');
  expect(actionErrorMessage({shortMessage:'Insufficient funds.',message:'Full RPC details'})).toBe('Insufficient funds.');
  expect(actionErrorMessage(Error('Transaction failed.\nRequest Arguments: data: 0x123'))).toBe('Transaction failed.');
});
