export const FIXED_DECIMAL_SCALE = BigInt(100_000_000);

export function parseFixedDecimal(value: string): bigint {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) {
    throw new Error("Expected a non-negative decimal with at most 8 decimal places.");
  }
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * FIXED_DECIMAL_SCALE + BigInt(fraction.padEnd(8, "0"));
}

export function formatFixedDecimal(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const integer = absolute / FIXED_DECIMAL_SCALE;
  const fraction = (absolute % FIXED_DECIMAL_SCALE)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}
