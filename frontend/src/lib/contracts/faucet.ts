import {encodeFunctionData, type Address, type Hex} from 'viem';
import manifest from './faucet-deployment.json';
import {testTokenAbi} from './generated';

export const faucetTokens = manifest.tokens.map(token => ({...token, address: token.address as Address}));
export const faucetCalldata = encodeFunctionData({abi:testTokenAbi, functionName:'faucet'});
// Supplemental tokens can ONLY receive a faucet call, not arbitrary approvals/transfers.
export function isTrustedFaucetCall(address: Address, data: Hex) {
  return manifest.chainId === 97 && data === faucetCalldata && faucetTokens.some(token => token.address.toLowerCase() === address.toLowerCase());
}
