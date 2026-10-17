import type { RuntimeConfig } from "../api/types";

type ContractAddresses = Pick<RuntimeConfig, "awakeningAddress" | "settlementAddress" | "patAddress" | "optionVaultAddress">;
const address = /^0x[a-fA-F0-9]{40}$/;

export function contractsAreReady(config: ContractAddresses) {
  return [
    config.awakeningAddress,
    config.settlementAddress,
    config.patAddress,
    config.optionVaultAddress,
  ].every(
    (value) =>
      typeof value === "string" && address.test(value) && !/^0x0{40}$/i.test(value),
  );
}
