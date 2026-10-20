import { roundToPaise } from "./money";

export type TaxProfile = {
  cgstBps: number;
  sgstBps: number;
  igstBps: number;
  cessBps: number;
  inclusive: boolean;
  interState?: boolean;
};

export type CartLineInput = {
  qty: number;
  unitPaise: number;
  discountPaise?: number;
  tax: TaxProfile;
};

export type BillInput = {
  lines: CartLineInput[];
  billDiscountPaise?: number;
  servicePaise?: number;
  deliveryPaise?: number;
};

export type TaxSplit = {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  taxPaise: number;
};

export type LineResult = {
  qty: number;
  unitPaise: number;
  discountPaise: number;
  taxablePaise: number;
  tax: TaxSplit;
  linePaise: number;
};

export type BillResult = {
  lines: LineResult[];
  subtotalPaise: number;
  itemDiscountPaise: number;
  billDiscountPaise: number;
  servicePaise: number;
  deliveryPaise: number;
  tax: TaxSplit;
  roundOffPaise: number;
  totalPaise: number;
};

function emptyTax(): TaxSplit {
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0, taxPaise: 0 };
}

function bps(amount: number, basisPoints: number): number {
  return roundToPaise((amount * basisPoints) / 10_000);
}

export function splitTax(taxablePaise: number, tax: TaxProfile): TaxSplit {
  if (tax.interState) {
    const igstPaise = bps(taxablePaise, tax.igstBps);
    const cessPaise = bps(taxablePaise, tax.cessBps);
    return {
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise,
      cessPaise,
      taxPaise: igstPaise + cessPaise,
    };
  }
  const cgstPaise = bps(taxablePaise, tax.cgstBps);
  const sgstPaise = bps(taxablePaise, tax.sgstBps);
  const cessPaise = bps(taxablePaise, tax.cessBps);
  return {
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    cessPaise,
    taxPaise: cgstPaise + sgstPaise + cessPaise,
  };
}

export function combinedRateBps(tax: TaxProfile): number {
  const gst = tax.interState ? tax.igstBps : tax.cgstBps + tax.sgstBps;
  return gst + tax.cessBps;
}

export function extractInclusiveTaxable(grossPaise: number, tax: TaxProfile): number {
  const rate = combinedRateBps(tax);
  if (rate <= 0) return grossPaise;
  return roundToPaise((grossPaise * 10_000) / (10_000 + rate));
}

export function calculateLine(line: CartLineInput): LineResult {
  const discountPaise = Math.max(0, line.discountPaise ?? 0);
  const gross = roundToPaise(line.qty * line.unitPaise) - discountPaise;
  const safeGross = Math.max(0, gross);
  const taxablePaise = line.tax.inclusive
    ? extractInclusiveTaxable(safeGross, line.tax)
    : safeGross;
  const tax = splitTax(taxablePaise, line.tax);
  const linePaise = line.tax.inclusive ? safeGross : taxablePaise + tax.taxPaise;
  return {
    qty: line.qty,
    unitPaise: line.unitPaise,
    discountPaise,
    taxablePaise,
    tax,
    linePaise,
  };
}

function sumTax(parts: TaxSplit[]): TaxSplit {
  return parts.reduce(
    (acc, t) => ({
      cgstPaise: acc.cgstPaise + t.cgstPaise,
      sgstPaise: acc.sgstPaise + t.sgstPaise,
      igstPaise: acc.igstPaise + t.igstPaise,
      cessPaise: acc.cessPaise + t.cessPaise,
      taxPaise: acc.taxPaise + t.taxPaise,
    }),
    emptyTax(),
  );
}

export function calculateBill(input: BillInput): BillResult {
  const lines = input.lines.map(calculateLine);
  const subtotalPaise = lines.reduce((s, l) => s + l.taxablePaise, 0);
  const itemDiscountPaise = lines.reduce((s, l) => s + l.discountPaise, 0);
  const billDiscountPaise = Math.max(0, input.billDiscountPaise ?? 0);
  const servicePaise = Math.max(0, input.servicePaise ?? 0);
  const deliveryPaise = Math.max(0, input.deliveryPaise ?? 0);
  const lineTax = sumTax(lines.map((l) => l.tax));
  const afterItem = lines.reduce((s, l) => s + l.linePaise, 0);
  const discounted = Math.max(0, afterItem - billDiscountPaise);
  const beforeRound = discounted + servicePaise + deliveryPaise;
  const rounded = roundToPaise(Math.round(beforeRound / 100) * 100);
  const roundOffPaise = rounded - beforeRound;
  return {
    lines,
    subtotalPaise,
    itemDiscountPaise,
    billDiscountPaise,
    servicePaise,
    deliveryPaise,
    tax: lineTax,
    roundOffPaise,
    totalPaise: rounded,
  };
}

export function profitPaise(sellingPaise: number, purchasePaise: number, qty: number, taxPaise: number): number {
  return roundToPaise(qty * (sellingPaise - purchasePaise)) - taxPaise;
}

export const MANUAL_PAYMENT_METHODS = ["UPI", "CARD", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "SPLIT"] as const;
export const GATEWAY_PAYMENT_METHODS = ["RAZORPAY"] as const;

export function requiresManualConfirmation(method: string): boolean {
  return MANUAL_PAYMENT_METHODS.includes(method as (typeof MANUAL_PAYMENT_METHODS)[number]);
}

export function isCashMethod(method: string): boolean {
  return method === "CASH";
}
