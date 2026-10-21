"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { formatMoney } from "@/lib/money";
import { calculateBill, type TaxProfile } from "@/lib/billing";
import { upiPaymentUri } from "@/lib/qr";

type Variant = { id: string; name: string; sku?: string | null; barcode?: string | null; sellingPaise?: number | null; stockQty: number; isActive?: boolean };
type Product = { id: string; name: string; description?: string | null; dietary?: string | null; portion?: string | null; prepMinutes?: number | null; allergens?: string | null; images: { id: string; url: string }[]; sku?: string | null; barcode?: string | null; sellingPaise: number; discountPaise?: number | null; variants: Variant[]; category?: { name: string } | null; inventory: { qty: number }[]; taxRate?: TaxProfile | null };
type CartLine = { product: Product; variant?: Variant; qty: number };
type Customer = { id: string; name: string; phone?: string | null; outstandingPaise: number };
type ReceiptTaxGroup = { cgstBps: number; sgstBps: number; igstBps: number; cessBps: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number };
type ReceiptOrder = { invoiceNumber: string; createdAt: string; subtotalPaise: number; taxPaise: number; billDiscountPaise: number; roundOffPaise: number; totalPaise: number; items: { name: string; qty: number; unitPaise: number; linePaise: number }[]; payments: { method: string; amountPaise: number }[]; customer?: { name: string } | null; invoice?: { snapshotJson?: string } | null; business?: { name?: string; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; phone?: string | null; gstin?: string | null; logoUrl?: string | null; footer?: string | null; returnPolicy?: string | null }; taxBreakdown?: ReceiptTaxGroup[] };

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("CASH");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [camera, setCamera] = useState(false);
  const [hospitality, setHospitality] = useState(false);
  const [hotelMode, setHotelMode] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiMcc, setUpiMcc] = useState("0000");
  const [upiQrUrl, setUpiQrUrl] = useState("");
  const [generatedUpiQr, setGeneratedUpiQr] = useState("");
  const [businessName, setBusinessName] = useState("GillBill");
  const [defaultTax, setDefaultTax] = useState<TaxProfile>({ cgstBps: 0, sgstBps: 0, igstBps: 0, cessBps: 0, inclusive: false });
  const [businessModeLoaded, setBusinessModeLoaded] = useState(false);
  const [category, setCategory] = useState("All dishes");
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
  const [receiptWidth, setReceiptWidth] = useState(80);
  const searchRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const checkoutNonce = useRef<string | null>(null);
  const checkoutSignature = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/products?pos=1", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to load products");
    setProducts(data.products);
  }, []);
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, [refresh]);
  useEffect(() => { fetch("/api/customers", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (Array.isArray(d.customers)) setCustomers(d.customers); }).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/business", { cache: "no-store" }).then((r) => r.json()).then((d) => { const business = d.business; setHospitality(Boolean(business?.restaurantEnabled || business?.hotelEnabled)); setHotelMode(Boolean(business?.hotelEnabled)); setUpiId(business?.upiId ?? ""); setUpiMcc(business?.upiMcc ?? "0000"); setUpiQrUrl(business?.upiQrUrl ?? ""); setBusinessName(business?.name ?? "GillBill"); if (business) setDefaultTax({ cgstBps: business.defaultCgstBps ?? 0, sgstBps: business.defaultSgstBps ?? 0, igstBps: business.defaultIgstBps ?? 0, cessBps: 0, inclusive: Boolean(business.pricesTaxInclusive) }); }).catch(() => setHospitality(true)).finally(() => setBusinessModeLoaded(true)); }, []);
  useEffect(() => { if (hospitality && payment === "CREDIT") setPayment("CASH"); if (hospitality && !hotelMode) setCustomerId(""); }, [hospitality, hotelMode, payment]);

  const add = useCallback((product: Product, variant?: Variant) => setCart((old) => {
    const key = `${product.id}:${variant?.id ?? ""}`;
    const found = old.find((line) => `${line.product.id}:${line.variant?.id ?? ""}` === key);
    return found ? old.map((line) => `${line.product.id}:${line.variant?.id ?? ""}` === key ? { ...line, qty: line.qty + 1 } : line) : [...old, { product, variant, qty: 1 }];
  }), []);
  const bill = useMemo(() => calculateBill({ lines: cart.map((line) => ({ qty: line.qty, unitPaise: line.variant?.sellingPaise ?? line.product.sellingPaise, tax: line.product.taxRate ?? defaultTax })) }), [cart, defaultTax]);
  const total = bill.totalPaise;
  const upiPaymentPayload = useMemo(() => {
    if (!upiId || total <= 0) return "";
    try { return upiPaymentUri({ upiId, businessName, amountPaise: total, mcc: upiMcc }); }
    catch { return ""; }
  }, [businessName, total, upiId, upiMcc]);
  useEffect(() => {
    let cancelled = false;
    setGeneratedUpiQr("");
    if (!upiPaymentPayload) return () => { cancelled = true; };
    void QRCode.toDataURL(upiPaymentPayload, { errorCorrectionLevel: "M", margin: 4, width: 360, color: { dark: "#000000", light: "#ffffff" } })
      .then((qr) => { if (!cancelled) setGeneratedUpiQr(qr); })
      .catch(() => { if (!cancelled) setGeneratedUpiQr(""); });
    return () => { cancelled = true; };
  }, [upiPaymentPayload]);
  const categories = ["All dishes", ...new Set(products.map((p) => p.category?.name).filter((name): name is string => Boolean(name)))];
  const filtered = products.filter((p) => (category === "All dishes" || p.category?.name === category) && `${p.name} ${p.description ?? ""} ${p.sku ?? ""} ${p.barcode ?? ""} ${p.variants.map((v) => `${v.name} ${v.sku ?? ""} ${v.barcode ?? ""}`).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const quantityFor = (product: Product) => cart.find((line) => line.product.id === product.id && !line.variant)?.qty ?? 0;
  const changeQuantity = (product: Product, delta: number) => setCart((old) => {
    const line = old.find((item) => item.product.id === product.id && !item.variant);
    if (!line && delta > 0) return [...old, { product, qty: 1 }];
    return old.flatMap((item) => item === line ? (item.qty + delta > 0 ? [{ ...item, qty: item.qty + delta }] : []) : [item]);
  });
  const scan = useCallback((value: string) => {
    const code = value.trim().toLowerCase();
    if (!code) return;
    const product = products.find((p) => [p.barcode, p.sku].some((x) => x?.toLowerCase() === code));
    const variantMatch = products.flatMap((p) => p.variants.map((v) => ({ p, v }))).find(({ v }) => [v.barcode, v.sku].some((x) => x?.toLowerCase() === code));
    if (variantMatch) add(variantMatch.p, variantMatch.v);
    else if (product) {
      if (product.variants.length) setMessage(`Choose a variant for ${product.name}.`);
      else add(product);
    }
    else setMessage(`No product found for “${value.trim()}”.`);
    setQuery("");
  }, [add, products]);
  useEffect(() => {
    if (!camera || hospitality || !businessModeLoaded) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer = 0;
    const run = async () => {
      type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
      const w = window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => Detector };
      if (!w.BarcodeDetector) { setMessage("Camera scanning is not supported in this browser. Use a USB scanner or type the code."); setCamera(false); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new w.BarcodeDetector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });
        const loop = async () => {
          if (stopped || !videoRef.current) return;
          try { const hits = await detector.detect(videoRef.current); if (hits[0]?.rawValue) { scan(hits[0].rawValue); setCamera(false); return; } } catch { /* Keep the preview running while the camera focuses. */ }
          timer = window.setTimeout(loop, 350);
        };
        void loop();
      } catch { setMessage("Camera access failed. Allow camera access or use a USB scanner."); setCamera(false); }
    };
    void run();
    return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [businessModeLoaded, camera, hospitality, scan]);
  const checkout = async () => {
    if (!cart.length || busy) return;
    setBusy(true); setMessage("");
    try {
      if (payment === "CREDIT" && !customerId) throw new Error("Select a customer account before charging to credit.");
      if (hotelMode && !customerId) throw new Error("Select a hotel guest before generating the bill.");
      if (payment === "UPI" && !upiQrUrl && !generatedUpiQr) throw new Error("Add a valid merchant UPI ID in Business settings, or upload your official bank QR.");
      const confirmed = payment === "CASH" || payment === "CREDIT" || window.confirm(payment === "UPI" ? `Confirm you received ${formatMoney(total)} from the customer in your UPI app?` : `Confirm ${payment} payment of ${formatMoney(total)} was received on the terminal/app?`);
      if (!confirmed) return;
      const items = cart.map((line) => ({ productId: line.product.id, variantId: line.variant?.id, qty: line.qty }));
      const signature = JSON.stringify({ customerId, items, method: payment, total });
      if (!checkoutNonce.current || checkoutSignature.current !== signature) checkoutNonce.current = crypto.randomUUID();
      checkoutSignature.current = signature;
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientNonce: checkoutNonce.current, customerId: customerId || undefined, items, payments: [{ method: payment, amountPaise: total, confirmed: payment !== "CASH" }] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      let width = 80;
      try { width = Number(data.order.invoice?.snapshotJson ? JSON.parse(data.order.invoice.snapshotJson).business?.paperWidthMm : 80); } catch { /* Keep the standard receipt width if the saved snapshot is incomplete. */ }
      setReceiptWidth([51, 58, 80].includes(width) ? width : 80);
      const completedOrder = data.order as ReceiptOrder;
      try { const snapshot = JSON.parse(completedOrder.invoice?.snapshotJson ?? "{}"); completedOrder.business = snapshot.business; completedOrder.taxBreakdown = snapshot.taxBreakdown; } catch { /* Receipt still prints if older invoice data has no business snapshot. */ }
      setReceipt(completedOrder);
      setMessage(`Bill ${data.order.invoiceNumber} generated successfully.`);
      setCart([]); checkoutNonce.current = null; checkoutSignature.current = null; setCustomerId(""); setPayment("CASH"); await refresh(); searchRef.current?.focus();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Checkout failed"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-7xl p-5 lg:p-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">{hospitality ? "Restaurant & hotel service" : "Point of sale"}</p><h1 className="mt-1 text-3xl font-bold">{hospitality ? "Food & dishes" : "New sale"}</h1><p className="mt-1 text-sm text-slate-500">{hospitality ? "Choose dishes from the menu, set quantities, then generate the customer bill." : "Scan a barcode or search the product catalog."}</p></div><div className="text-sm font-medium text-slate-500">{hospitality ? `${products.length} menu items` : "Ready to take an order"}</div></header>
    {message && <div role="status" className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{message}</div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex gap-2"><input ref={searchRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (businessModeLoaded && !hospitality && e.key === "Enter") scan(query); }} placeholder={hospitality ? "Search dishes by name or details…" : "Search products by name or scan a code…"} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />{businessModeLoaded && !hospitality && <button onClick={() => setCamera(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Scan QR / barcode</button>}</div>
        {!hospitality && camera && <div className="relative mb-4 overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="max-h-72 w-full object-cover"/><button onClick={() => setCamera(false)} className="absolute right-3 top-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold">Close camera</button></div>}
        {hospitality && <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{categories.map((name) => <button key={name} onClick={() => setCategory(name)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${category === name ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{name}</button>)}</div>}
        <div className={`grid gap-3 ${hospitality ? "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>{filtered.map((p) => <article key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className={`w-full overflow-hidden ${hospitality ? "h-32" : "h-44"} bg-slate-50`}>
            {p.images?.[0]?.url ? <Image src={p.images[0].url} alt={p.name} width={720} height={440} unoptimized className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-orange-50 to-emerald-50 text-4xl" aria-label="No dish photo">🍽️</div>}
          </div>
          <div className={hospitality ? "p-3" : "p-4"}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold">{p.name}</h2><p className="mt-0.5 truncate text-xs font-medium text-emerald-700">{p.category?.name ?? (hospitality ? "Chef’s selection" : p.sku ?? "Item")}</p></div><span className="shrink-0 text-sm font-bold">{formatMoney(p.sellingPaise)}</span></div>{p.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">{p.description}</p>}<div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">{p.portion && <span>{p.portion}</span>}{p.prepMinutes && <span>· {p.prepMinutes} min</span>}{p.dietary && <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">{p.dietary}</span>}{p.allergens && <span>· Allergens: {p.allergens}</span>}{!hospitality && <span>· Stock {p.inventory?.[0]?.qty ?? 0}</span>}</div><div className="mt-3">{p.variants.length ? <div className="flex flex-wrap gap-2">{p.variants.filter((v) => v.isActive !== false).map((v) => <button key={v.id} onClick={() => add(p, v)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-blue-100">{v.name}{v.sellingPaise != null ? ` · ${formatMoney(v.sellingPaise)}` : ""}</button>)}</div> : quantityFor(p) === 0 ? <button onClick={() => hospitality ? changeQuantity(p, 1) : add(p)} className="w-full rounded-lg border border-emerald-700 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">{hospitality ? "＋ Add" : "Add item"}</button> : <div className="ml-auto flex w-fit items-center gap-4 rounded-lg border border-emerald-700 px-3 py-1.5 text-emerald-800"><button aria-label={`Remove one ${p.name}`} onClick={() => changeQuantity(p, -1)} className="text-xl font-bold">−</button><span className="min-w-4 text-center font-bold">{quantityFor(p)}</span><button aria-label={`Add one ${p.name}`} onClick={() => changeQuantity(p, 1)} className="text-xl font-bold">＋</button></div>}</div></div></article>)}</div>
        {!filtered.length && <p className="py-12 text-center text-slate-500">No matching products. Add products in the Products section first.</p>}
      </section>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Current bill</h2><button className="text-sm text-red-600" onClick={() => setCart([])}>Clear</button></div><div className="my-4 max-h-[45vh] space-y-3 overflow-auto">{cart.map((line) => <div key={`${line.product.id}:${line.variant?.id ?? ""}`} className="flex items-center gap-3 border-b border-slate-100 pb-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{line.product.name}{line.variant ? ` · ${line.variant.name}` : ""}</p><p className="text-xs text-slate-500">{formatMoney(line.variant?.sellingPaise ?? line.product.sellingPaise)} each</p></div><button aria-label="Decrease quantity" onClick={() => setCart((old) => old.flatMap((x) => x === line ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x]))} className="rounded bg-slate-100 px-2">−</button><span className="w-5 text-center">{line.qty}</span><button aria-label="Increase quantity" onClick={() => setCart((old) => old.map((x) => x === line ? { ...x, qty: x.qty + 1 } : x))} className="rounded bg-slate-100 px-2">+</button><strong className="w-20 text-right">{formatMoney((line.variant?.sellingPaise ?? line.product.sellingPaise) * line.qty)}</strong></div>)}</div><div className="flex justify-between border-t border-slate-200 py-4 text-lg font-bold"><span>Total</span><span>{formatMoney(total)}</span></div><div className="-mt-3 mb-4 flex justify-between text-xs text-slate-500"><span>Tax included in total</span><span>{formatMoney(bill.tax.taxPaise)}</span></div>{(!hospitality || hotelMode) && <label className="mb-3 block text-sm font-medium">{hotelMode ? "Hotel guest (required)" : "Customer (optional)"}<select required={hotelMode} value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3"><option value="">{hotelMode ? "Select a guest" : "Walk-in customer"}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}</select></label>}<label className="mb-3 block text-sm font-medium">Payment method<select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3"><option value="CASH">Cash collected</option><option value="UPI">UPI (scan to pay)</option><option value="CARD">Card (confirm approved)</option>{!hospitality && <option value="CREDIT">Customer credit</option>}</select></label>{payment === "UPI" && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">{!(generatedUpiQr || upiQrUrl) ? <p className="text-sm font-medium text-amber-800">Enter your bank UPI ID in Business Settings or upload your bank-issued QR.</p> : <><p className="text-sm font-semibold">Scan to pay {formatMoney(total)}</p><Image src={generatedUpiQr || upiQrUrl} alt="UPI bill payment QR" width={240} height={240} unoptimized className="mx-auto my-2 h-60 w-60 rounded bg-white p-2"/>{upiId && <p className="text-xs text-slate-600">Pay to {upiId}</p>}<p className="mt-1 text-[11px] text-slate-600">The bill amount is included in this QR. Verify payment in your UPI app before recording the sale.</p>{generatedUpiQr && upiMcc === "0000" && <p className="mt-2 text-[11px] font-medium text-amber-800">If your bank app rejects the payment, confirm this UPI ID accepts incoming payments and the payee name matches your bank profile.</p>}</>}</div>}<button disabled={!cart.length || busy} onClick={checkout} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Processing…" : payment === "UPI" ? `Confirm UPI · ${formatMoney(total)}` : `Charge ${formatMoney(total)}`}</button></aside>
    </div>
    {receipt && <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-slate-950/50 p-4"><section id="receipt-print" style={{ "--receipt-width": `${receiptWidth}mm` } as React.CSSProperties} className="receipt-paper rounded-2xl bg-white p-6 shadow-2xl"><div className="text-center">{receipt.business?.logoUrl && <Image src={receipt.business.logoUrl} alt={`${receipt.business.name ?? "Business"} logo`} width={120} height={72} unoptimized className="mx-auto mb-2 max-h-16 w-auto object-contain" />}<h2 className="text-base font-extrabold">{receipt.business?.name ?? "Business"}</h2>{receipt.business?.address && <p className="text-[10px]">{receipt.business.address}</p>}{(receipt.business?.city || receipt.business?.state || receipt.business?.pincode) && <p className="text-[10px]">{[receipt.business.city, receipt.business.state, receipt.business.pincode].filter(Boolean).join(", ")}</p>}{receipt.business?.phone && <p className="text-[10px]">Mobile: {receipt.business.phone}</p>}<p className="mt-2 text-xs font-bold">GSTIN: {receipt.business?.gstin ?? "—"}</p><h2 className="mt-1 text-xl font-bold">Tax Invoice</h2><p className="mt-1 text-xs text-slate-500">Invoice {receipt.invoiceNumber} · {new Date(receipt.createdAt).toLocaleString()}</p>{receipt.customer && <p className="mt-1 text-xs">Customer: {receipt.customer.name}</p>}</div><div className="my-5 space-y-2 border-y py-4">{receipt.items.map((item, i) => <div key={`${item.name}-${i}`} className="flex justify-between gap-3 text-xs"><span>{item.name} × {item.qty}</span><span>{formatMoney(item.linePaise)}</span></div>)}</div><div className="space-y-2 text-xs"><div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(receipt.subtotalPaise)}</span></div>{receipt.billDiscountPaise > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatMoney(receipt.billDiscountPaise)}</span></div>}{receipt.taxBreakdown?.length ? receipt.taxBreakdown.map((tax, index) => <div key={`tax-${index}`} className="space-y-1">{tax.cgstPaise > 0 && <div className="flex justify-between"><span>CGST @ {(tax.cgstBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</span><span>{formatMoney(tax.cgstPaise)}</span></div>}{tax.sgstPaise > 0 && <div className="flex justify-between"><span>SGST @ {(tax.sgstBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</span><span>{formatMoney(tax.sgstPaise)}</span></div>}{tax.igstPaise > 0 && <div className="flex justify-between"><span>IGST @ {(tax.igstBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</span><span>{formatMoney(tax.igstPaise)}</span></div>}{tax.cessPaise > 0 && <div className="flex justify-between"><span>Cess @ {(tax.cessBps / 100).toFixed(2).replace(/\.?0+$/, "")}%</span><span>{formatMoney(tax.cessPaise)}</span></div>}</div>) : <div className="flex justify-between"><span>Tax</span><span>{formatMoney(receipt.taxPaise)}</span></div>}<div className="flex justify-between font-bold"><span>{receipt.payments.some((p) => p.method === "CREDIT") ? "Charged to account" : "Total paid"}</span><span>{formatMoney(receipt.totalPaise)}</span></div><p className="text-[10px] text-slate-500">{receipt.payments.map((p) => `${p.method === "CREDIT" ? "On account" : p.method}: ${formatMoney(p.amountPaise)}`).join(" · ")}</p></div><footer className="mt-4 border-t pt-3 text-center text-[10px]"><p className="font-semibold">{receipt.business?.footer || "Thank you for your business!"}</p>{receipt.business?.returnPolicy && <p className="mt-1 whitespace-pre-wrap text-slate-600"><strong>Return policy: </strong>{receipt.business.returnPolicy}</p>}</footer><div className="mt-6 flex gap-2 receipt-actions"><button onClick={() => window.print()} className="flex-1 rounded-xl bg-blue-700 px-3 py-3 text-sm font-bold text-white">Save as PDF</button><button onClick={() => window.print()} className="flex-1 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white">Print 2″ / 58 mm</button><button onClick={() => setReceipt(null)} className="rounded-xl border px-3 py-3 text-sm font-semibold">New order</button></div><p className="receipt-actions mt-2 text-center text-[11px] text-slate-500">In the print dialog, select “Save as PDF” or your thermal printer.</p></section></div>}
  </main>;
}






