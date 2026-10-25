import path from "node:path";
import {readFileSync} from "node:fs";
import { defineConfig } from "vitest/config";

const network = process.env.NEXT_PUBLIC_TESTNET ?? 'bsc-testnet';
const names:Record<string,string> = {'bsc-testnet':'bsc-testnet-97','arbitrum-sepolia':'arbitrum-sepolia-421614','robinhood-testnet':'robinhood-testnet-46630'};
export default defineConfig({
  define:{
    "process.env.NEXT_PUBLIC_DEPLOYMENT_MANIFEST":JSON.stringify(readFileSync(path.resolve(__dirname,`../contracts/deployments/${names[network]}.json`),"utf8")),
    "process.env.NEXT_PUBLIC_FAUCET_MANIFEST":JSON.stringify(readFileSync(path.resolve(__dirname,`../contracts/deployments/faucet-${names[network]}.json`),"utf8")),
  },
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
