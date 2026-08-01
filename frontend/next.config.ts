import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
