export function formatDecimal(value: string, maximumFractionDigits = 6): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const integer = match[1].replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (match[2] ?? "").slice(0, maximumFractionDigits).replace(/0+$/, "");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
