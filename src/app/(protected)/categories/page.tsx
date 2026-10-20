"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Category = { id: string; name: string; kind: string; sortOrder: number };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("PRODUCT");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/categories", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load categories.");
    setCategories(data.categories);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/categories", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId || undefined, name, kind }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save category.");
      setName(""); setKind("PRODUCT"); setEditingId(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save category."); }
    finally { setBusy(false); }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete category.");
      if (editingId === category.id) { setEditingId(""); setName(""); setKind("PRODUCT"); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete category."); }
    finally { setBusy(false); }
  }

  return <div><header className="mb-6"><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Catalog setup</p><h1 className="mt-1 text-3xl font-bold">Categories</h1><p className="mt-2 text-sm text-slate-500">Organize products and food menu items.</p></header>
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">{editingId ? "Edit category" : "Add category"}</h2><label className="block text-sm font-medium">Category name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" placeholder="e.g. Starters" /></label><label className="block text-sm font-medium">Category type<select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="PRODUCT">Product</option><option value="FOOD">Food / dish</option></select></label><div className="flex gap-2"><button disabled={busy} className="flex-1 rounded-lg bg-blue-700 py-3 font-semibold text-white">{editingId ? "Save changes" : "Add category"}</button>{editingId && <button type="button" onClick={() => { setEditingId(""); setName(""); setKind("PRODUCT"); }} className="rounded-lg border px-4">Cancel</button>}</div></form>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-bold">Your categories</h2></div>{categories.length ? <div className="divide-y">{categories.map((category) => <article key={category.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{category.name}</b><p className="mt-1 text-xs text-slate-500">{category.kind === "FOOD" ? "Food / dish" : "Product"} · Sort order {category.sortOrder}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => { setEditingId(category.id); setName(category.name); setKind(category.kind); setError(""); }} className="rounded-lg border px-3 py-2 text-sm">Edit</button><button disabled={busy} onClick={() => remove(category)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700">Delete</button></div></article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">No categories yet. Add one to organize your catalog.</p>}</section>
    </div>
  </div>;
}
