import { isAddress } from 'viem';
import { ACTIVE_CHAIN_ID } from '../networks';

type LiveAccessInput = {
  address?: string;
  chainId?: number;
  integrationEnabled: boolean;
  runtimeReady: boolean;
  runtimeChainId?: number;
  contractsVerified: boolean;
};

// This is intentionally false until the chain adapter and deployment are verified.
export const LIVE_INTEGRATION_ENABLED = false;

export function canTransact(input: LiveAccessInput): boolean {
  return !!input.address && isAddress(input.address) && input.chainId === ACTIVE_CHAIN_ID
    && input.runtimeChainId === ACTIVE_CHAIN_ID && input.integrationEnabled
    && input.runtimeReady && input.contractsVerified;
}
