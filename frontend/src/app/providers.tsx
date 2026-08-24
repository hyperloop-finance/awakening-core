'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { DemoWalletProvider } from '@/components/shell/wallet';
import { wagmiConfig } from '@/lib/wagmi';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DemoWalletProvider>{children}</DemoWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
