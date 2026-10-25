import { http } from 'viem';
import { createConfig, createConnector } from 'wagmi';
import { connectorsForWallets, type Wallet } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { bscTestnet, arbitrumSepolia } from 'wagmi/chains';
import { ACTIVE_PROFILE, robinhoodTestnet, assetPath } from './networks';
import { injected } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

// With no WalletConnect project, MetaMask uses its browser provider only.
// RainbowKit supplies installation guidance; EIP-6963 discovers other installed wallets.
const metaMaskInjectedWallet = (): Wallet => ({
  id: 'metaMask', name: 'MetaMask', rdns: 'io.metamask',
  iconUrl: assetPath('/wallets/metamask.svg'), iconBackground: '#fff',
  downloadUrls: { browserExtension: 'https://metamask.io/download', mobile: 'https://metamask.io/download' },
  createConnector: details => createConnector(config => ({
    ...injected({ target: 'metaMask' })(config), ...details,
  })),
});

const connectors = connectorsForWallets([
  { groupName: 'Popular', wallets: [projectId ? metaMaskWallet : metaMaskInjectedWallet, rabbyWallet,
    ...(projectId ? [walletConnectWallet] : []), injectedWallet] },
], { appName: 'Hyperloop Finance', projectId: projectId ?? '' });

export const wagmiConfig = createConfig({
  chains: ACTIVE_PROFILE==='bsc-testnet'?[bscTestnet,arbitrumSepolia,robinhoodTestnet]:ACTIVE_PROFILE==='arbitrum-sepolia'?[arbitrumSepolia,robinhoodTestnet]:[robinhoodTestnet,arbitrumSepolia],
  multiInjectedProviderDiscovery: true,
  connectors,
  transports: {
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc', {timeout:10_000,retryCount:1}),
    [robinhoodTestnet.id]: http(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com', {timeout:10_000,retryCount:1}),
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL ?? 'https://bsc-testnet.bnbchain.org', { timeout: 10_000, retryCount: 1 }),
  },
  ssr: true,
});
