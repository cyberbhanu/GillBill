/** Build a UPI payment link for one POS bill. */
export function upiPaymentUri(input: { upiId: string; businessName: string; amountPaise: number; mcc?: string }) {
  const upiId = input.upiId.trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(upiId)) throw new Error("Enter a valid bank UPI ID (VPA) in Business settings.");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new Error("Add items to the bill before generating a payment QR.");

  const params = new URLSearchParams({
    pa: upiId,
    pn: input.businessName.trim().slice(0, 25) || "Merchant",
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
  });

  // A regular bank VPA uses a simple pay link. Merchant fields are included
  // only when the bank/acquirer assigned a merchant MCC to this VPA.
  if (/^\d{4}$/.test(input.mcc ?? "") && input.mcc !== "0000") {
    params.set("mc", input.mcc!);
    params.set("tr", `${Date.now()}${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`);
  }

  return `upi://pay?${params.toString()}`;
}
