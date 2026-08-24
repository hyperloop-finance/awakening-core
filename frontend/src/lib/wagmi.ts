import { defineChain, http } from 'viem';
import { injected } from '@wagmi/core';
import { createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export const anvil = defineChain({
  id: 31337,
  name: 'Local Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'] } },
});

export const wagmiConfig = createConfig({
  chains: [anvil, sepolia],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
