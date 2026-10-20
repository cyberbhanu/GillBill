export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function rupeesToPaise(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

export function formatMoney(paise: number, currency = "INR"): string {
  const amount = paiseToRupees(paise);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
    return `${symbol}${amount.toFixed(2)}`;
  }
}

export function roundToPaise(value: number): number {
  return Math.round(value);
}
