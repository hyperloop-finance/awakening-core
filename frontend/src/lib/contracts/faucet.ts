import {encodeFunctionData, type Address, type Hex} from 'viem';
import bscManifest from './faucet-deployment.json';
const selectedManifest:unknown = JSON.parse(process.env.NEXT_PUBLIC_FAUCET_MANIFEST ?? '{}');
import {ACTIVE_PROFILE, ACTIVE_CHAIN_ID} from '../networks';
const manifest = (ACTIVE_PROFILE==='bsc-testnet'?bscManifest:selectedManifest) as typeof bscManifest;
import {testTokenAbi} from './selected-deployment';

export const faucetTokens = manifest.tokens.map(token => ({...token, address: token.address as Address}));
export const faucetCalldata = encodeFunctionData({abi:testTokenAbi, functionName:'faucet'});
// Supplemental tokens can ONLY receive a faucet call, not arbitrary approvals/transfers.
export function isTrustedFaucetCall(address: Address, data: Hex) {
  return manifest.chainId === ACTIVE_CHAIN_ID && data === faucetCalldata && faucetTokens.some(token => token.address.toLowerCase() === address.toLowerCase());
}
