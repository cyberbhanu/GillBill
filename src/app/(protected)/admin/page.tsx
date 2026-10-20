"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type User = { id: string; name: string; email?: string | null; phone?: string | null; createdAt?: string; memberships?: { business: { name: string } }[] };
type Plan = { id: string; name: string; description?: string | null; pricePaise: number; durationDays: number; offerLabel?: string | null; offerDiscountBps: number; isActive: boolean };
type Request = { id: string; createdAt: string; user: User; plan?: Plan | null };
type Subscription = { id: string; amountPaise: number; offerLabel?: string | null; status: string; endsAt: string; user: User; plan: Plan };
type AdminData = { pendingOwners: User[]; requests: Request[]; plans: Plan[]; subscriptions: Subscription[] };
type Tab = "approvals" | "sales" | "plans";
const blankPlan = { name: "", description: "", price: "", durationDays: "30", offerLabel: "", offerDiscount: "0" };
const money = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

export default function AdminPage() {
  const [data, setData] = useState<AdminData>({ pendingOwners: [], requests: [], plans: [], subscriptions: [] });
  const [tab, setTab] = useState<Tab>("approvals");
  const [form, setForm] = useState(blankPlan);
  const [editingId, setEditingId] = useState("");
  const [chosenPlans, setChosenPlans] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load super-admin dashboard.");
    setData(result);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Admin action failed.");
      setMessage("Saved successfully."); await load(); return result;
    } catch (e) { setError(e instanceof Error ? e.message : "Admin action failed."); return null; }
    finally { setBusy(false); }
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    const action = editingId ? "update-plan" : "create-plan";
    const result = await act({ action, plan: { id: editingId || undefined, name: form.name, description: form.description || null, pricePaise: Math.round(Number(form.price) * 100), durationDays: Number(form.durationDays), offerLabel: form.offerLabel || null, offerDiscountBps: Math.round(Number(form.offerDiscount) * 100) } });
    if (result) { setForm(blankPlan); setEditingId(""); }
  }

  function editPlan(plan: Plan) {
    setEditingId(plan.id); setForm({ name: plan.name, description: plan.description || "", price: (plan.pricePaise / 100).toFixed(2), durationDays: String(plan.durationDays), offerLabel: plan.offerLabel || "", offerDiscount: String(plan.offerDiscountBps / 100) });
  }

  const tabs: [Tab, string][] = [["approvals", `Owner approvals (${data.pendingOwners.length})`], ["sales", `Sales & subscriptions (${data.requests.length})`], ["plans", "Plans & offers"]];
  return <div>
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Platform control</p><h1 className="mt-1 text-3xl font-bold">Super admin</h1><p className="mt-2 text-sm text-slate-500">Review owner signups, confirm software sales, and manage subscriptions and offers.</p></header>
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-3 text-sm font-semibold ${tab === id ? "bg-violet-700 text-white" : "border bg-white text-slate-600"}`}>{label}</button>)}</div>
    {tab === "approvals" && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="text-lg font-bold">Shopkeeper account approvals</h2><p className="mt-1 text-sm text-slate-500">New owners can sign in and set up their business after approval.</p></div>{data.pendingOwners.length ? <div className="divide-y">{data.pendingOwners.map((owner) => <article key={owner.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><b>{owner.name}</b><p className="mt-1 text-sm text-slate-500">{owner.email || owner.phone || "No contact"} · requested {owner.createdAt ? new Date(owner.createdAt).toLocaleDateString() : "recently"}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => act({ action: "reject-owner", userId: owner.id })} className="rounded-lg border px-4 py-2 text-sm">Reject</button><button disabled={busy} onClick={() => act({ action: "approve-owner", userId: owner.id })} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Approve account</button></div></article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">No owner approvals waiting.</p>}</section>}
    {tab === "sales" && <div className="space-y-5"><section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="text-lg font-bold">Software sale confirmation</h2><p className="mt-1 text-sm text-slate-500">Confirm a sale after the owner account is approved and payment is verified externally.</p></div>{data.requests.length ? <div className="divide-y">{data.requests.map((request) => { const approved = data.pendingOwners.every((owner) => owner.id !== request.user.id); const business = request.user.memberships?.[0]?.business.name; return <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><b>{request.user.name}</b><p className="mt-1 text-sm text-slate-500">{business || "Business not set up"} · {request.user.email || request.user.phone} · {approved ? "Account approved" : "Account approval pending"}</p></div><div className="flex flex-wrap items-center gap-2"><select value={chosenPlans[request.id] || ""} onChange={(e) => setChosenPlans((v) => ({ ...v, [request.id]: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select plan</option>{data.plans.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.pricePaise)}</option>)}</select><button disabled={busy || !approved} onClick={() => act({ action: "confirm-sale", requestId: request.id, planId: chosenPlans[request.id] })} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm sale</button></div></article>; })}</div> : <p className="p-8 text-center text-sm text-slate-500">No sales waiting for confirmation.</p>}</section>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="text-lg font-bold">Owner subscriptions</h2></div>{data.subscriptions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Owner</th><th className="p-4">Plan</th><th className="p-4">Offer</th><th className="p-4">Paid</th><th className="p-4">Ends</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y">{data.subscriptions.map((s) => <tr key={s.id}><td className="p-4">{s.user.name}</td><td className="p-4">{s.plan.name}</td><td className="p-4">{s.offerLabel || "—"}</td><td className="p-4">{money(s.amountPaise)}</td><td className="p-4">{new Date(s.endsAt).toLocaleDateString()}</td><td className="p-4">{s.status}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">No subscriptions recorded yet.</p>}</section></div>}
    {tab === "plans" && <div className="grid items-start gap-5 xl:grid-cols-[380px_1fr]"><form onSubmit={savePlan} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">{editingId ? "Edit plan or offer" : "Create plan or offer"}</h2><label className="block text-sm">Plan name<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border p-3" placeholder="GillBill yearly" /></label><label className="block text-sm">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label><label className="block text-sm">Price (₹)<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label><label className="block text-sm">Duration (days)<input required type="number" min="1" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label><label className="block text-sm">Offer label<input value={form.offerLabel} onChange={(e) => setForm({ ...form, offerLabel: e.target.value })} className="mt-1 w-full rounded-lg border p-3" placeholder="Launch offer" /></label><label className="block text-sm">Discount (%)<input type="number" min="0" max="100" step="0.01" value={form.offerDiscount} onChange={(e) => setForm({ ...form, offerDiscount: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label><div className="flex gap-2"><button disabled={busy} className="flex-1 rounded-lg bg-violet-700 py-3 font-semibold text-white">{editingId ? "Save changes" : "Create plan"}</button>{editingId && <button type="button" onClick={() => { setEditingId(""); setForm(blankPlan); }} className="rounded-lg border px-4">Cancel</button>}</div></form>
      <section className="space-y-3">{data.plans.map((plan) => <article key={plan.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{plan.name}</h3>{plan.offerLabel && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{plan.offerLabel} · {plan.offerDiscountBps / 100}% off</span>}{!plan.isActive && <span className="text-xs text-slate-400">Archived</span>}</div><p className="mt-1 text-sm text-slate-500">{money(plan.pricePaise)} · {plan.durationDays} days · {plan.description || "No description"}</p></div><div className="flex gap-2"><button onClick={() => editPlan(plan)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>{plan.isActive && <button disabled={busy} onClick={() => act({ action: "archive-plan", planId: plan.id })} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700">Archive</button>}</div></article>)}{!data.plans.length && <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">Create your first subscription plan or offer.</p>}</section></div>}
  </div>;
}
