import path from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import type { NextConfig } from "next";

const network = process.env.NEXT_PUBLIC_TESTNET ?? 'bsc-testnet';
const deploymentNames: Record<string,string> = {'bsc-testnet':'bsc-testnet-97','arbitrum-sepolia':'arbitrum-sepolia-421614','robinhood-testnet':'robinhood-testnet-46630'};
const deploymentName = deploymentNames[network];
if(!deploymentName)throw Error(`Unknown NEXT_PUBLIC_TESTNET: ${network}`);
const deploymentPath = path.resolve(__dirname, '../contracts/deployments', `${deploymentName}.json`);
const faucetPath = path.resolve(__dirname, '../contracts/deployments', `faucet-${deploymentName}.json`);
for(const file of [deploymentPath,faucetPath])if(!existsSync(file))throw Error(`Selected network deployment is unavailable: ${file}`);

const nextConfig: NextConfig = {
  env: {NEXT_PUBLIC_DEPLOYMENT_MANIFEST:readFileSync(deploymentPath,'utf8'),NEXT_PUBLIC_FAUCET_MANIFEST:readFileSync(faucetPath,'utf8')},
  basePath: process.env.NEXT_PUBLIC_TESTNET === 'robinhood-testnet' ? '/robinhood' : '',
  // Keep local development unchanged; the VM release uses a self-contained server.
  ...(process.env.AWAKENING_STANDALONE === "1"
    ? { output: "standalone" as const, experimental: { cpus: 1 } }
    : {}),
  // The local dual-chain preview forwards the second standalone frontend.
  async rewrites() {
    return process.env.AWAKENING_LOCAL_DUAL === '1'
      ? [{source:'/robinhood/:path*',destination:'http://127.0.0.1:3001/robinhood/:path*'}]
      : [];
  },
  webpack(config) {
    // @wagmi/connectors pulls in @base-org/account → @coinbase/cdp-sdk →
    // @x402/* packages that are not installed (optional peer deps). Stub them
    // out so the build succeeds. None of these are used in the Awakening UI.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm": false,
      "@x402/svm/upto/client": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;
