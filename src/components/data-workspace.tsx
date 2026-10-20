"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

export type DataField = { name: string; label: string; type?: "text" | "email" | "tel" | "number" | "date" | "select"; required?: boolean; options?: string[]; placeholder?: string };
type Props = { title: string; eyebrow?: string; endpoint: string; resultKey: string; fields?: DataField[]; columns?: { key: string; label: string; money?: boolean }[]; createLabel?: string; fieldNames?: Record<string, string>; valueTypes?: Record<string, "number" | "boolean" | "currencyPaise"> };
const titleCase = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
function cell(record: Record<string, unknown>, key: string, money = false) {
  const value = key.split(".").reduce<unknown>((v, part) => v && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined, record);
  if (value == null || value === "") return "—";
  if (money && typeof value === "number") return formatMoney(value);
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "—";
  if (typeof value === "string" && (key.toLowerCase().includes("date") || key.toLowerCase().includes("at"))) return new Date(value).toLocaleString();
  return String(value);
}

export function DataWorkspace({ title, eyebrow = "Business workspace", endpoint, resultKey, fields = [], columns, createLabel, fieldNames = {}, valueTypes = {} }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { const res = await fetch(endpoint, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || `Unable to load ${title.toLowerCase()}`); const value = data[resultKey]; setRows(Array.isArray(value) ? value as Record<string, unknown>[] : []); }, [endpoint, resultKey, title]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const body = Object.fromEntries(Object.entries(values).map(([k, v]) => { const type = valueTypes[k]; const name = fieldNames[k] ?? k; const value = type === "boolean" ? v === "true" : type === "currencyPaise" ? Math.round(Number(v || 0) * 100) : type === "number" || (!type && ["amount", "qty", "seats", "capacity", "rate", "nights", "paperWidth", "creditLimitPaise"].includes(k)) ? Number(v || 0) : v; return [name, value]; })); const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Unable to save"); setValues({}); setShowForm(false); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); } finally { setBusy(false); } };
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]).filter((k) => !["id", "businessId", "branchId", "userId", "productId", "customerId", "supplierId", "passwordHash", "images", "payments", "items", "variants", "purchases", "bookings", "createdBy"].includes(k)).slice(0, 5).map((key) => ({ key, label: titleCase(key), money: key.toLowerCase().includes("paise") })) : []);
  return <div><header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">{eyebrow}</p><h1 className="mt-1 text-3xl font-bold">{title}</h1></div>{fields.length > 0 && <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{showForm ? "Close" : createLabel ?? `Add ${title.toLowerCase().replace(/s$/, "")}`}</button>}</header>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {showForm && <form onSubmit={submit} className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">{fields.map((field) => <label key={field.name} className="text-sm font-medium">{field.label}{field.type === "select" ? <select required={field.required} value={values[field.name] ?? ""} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3"><option value="">Choose…</option>{field.options?.map((option) => <option key={option} value={option}>{field.name === "paperWidth" ? (option === "51" ? "2 inch (51 mm)" : `${option} mm`) : titleCase(option.replaceAll("_", " "))}</option>)}</select> : <input required={field.required} type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} value={values[field.name] ?? ""} placeholder={field.placeholder} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />}</label>)}<div className="sm:col-span-2 lg:col-span-3"><button disabled={busy} className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div></form>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{cols.map((col) => <th key={col.key} className="p-4">{col.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, i) => <tr key={String(row.id ?? i)}>{cols.map((col) => <td key={col.key} className="p-4">{cell(row, col.key, col.money)}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="p-10 text-center text-slate-500">No records yet.</p>}</div>
  </div>;
}

