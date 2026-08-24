const scale = BigInt(100_000_000);
const maximum = BigInt(1_000_000) * scale;

function parseScaled(value: string): bigint {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * scale + BigInt(fraction.padEnd(8, "0"));
}

export function validateOfferInput(amount: string, apr: string) {
  if (!/^\d+(\.\d+)?$/.test(amount) || !/^\d+(\.\d+)?$/.test(apr)) {
    return "Use plain decimal values.";
  }
  if (
    (amount.split(".")[1]?.length ?? 0) > 8 ||
    (apr.split(".")[1]?.length ?? 0) > 8
  ) {
    return "Use at most 8 decimal places.";
  }
  const amountValue = parseScaled(amount);
  const aprValue = parseScaled(apr);
  if (amountValue <= BigInt(0)) return "Enter an amount greater than zero.";
  if (aprValue <= BigInt(0)) return "Enter an APR greater than zero.";
  if (amountValue > maximum || aprValue > maximum) return "Values must be at most 1000000.";
  return undefined;
}

export function canPreviewOffer({
  error,
  previewed,
}: {
  error?: string;
  previewed: boolean;
}) {
  return !error && previewed;
}

export function offerSummary({
  amount,
  apr,
  patCoverage,
}: {
  amount: string;
  apr: string;
  patCoverage: string;
}): [string, string][] {
  return [
    ["Offer amount", `${amount} USDC`],
    ["Fixed APR", `${apr}%`],
    ["PAT coverage", `${patCoverage}%`],
  ];
}
