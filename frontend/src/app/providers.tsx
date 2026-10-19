'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

import { WalletProvider } from '@/components/shell/wallet';
import { WalletAvatar } from '@/components/shell/wallet-avatar';
import { wagmiConfig } from '@/lib/wagmi';

const walletTheme = darkTheme({ accentColor: '#9300e4', accentColorForeground: '#ffffff', borderRadius: 'medium', fontStack: 'system' });
Object.assign(walletTheme.colors, {
  modalBackground: '#120a1e', modalBorder: 'rgba(171,61,239,.28)',
  modalBackdrop: 'rgba(6,2,12,.76)', modalText: '#ffffff',
  modalTextSecondary: '#eadff7', modalTextDim: '#a694b7',
  menuItemBackground: '#251137', actionButtonSecondaryBackground: '#190e27',
  generalBorder: 'rgba(171,61,239,.28)', profileForeground: '#190e27',
  profileAction: '#251137', profileActionHover: '#36194e',
});
walletTheme.fonts.body = 'var(--font-ui)';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={walletTheme} avatar={WalletAvatar} modalSize="compact" locale="en-US" appInfo={{appName:'Hyperloop Finance'}}>
          <WalletProvider>{children}</WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
