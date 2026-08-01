import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';

export const wagmiConfig = getDefaultConfig({
  appName: 'Awakening',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'PLACEHOLDER',
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
