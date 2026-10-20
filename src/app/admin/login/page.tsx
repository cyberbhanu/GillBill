"use client";

import Image from "next/image";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await signIn("credentials", { identifier: identifier.trim(), password, loginType: "admin", redirect: false });
      if (!result?.ok || result.error) { setError("Admin sign-in failed. Use the account whose email is configured as SUPER_ADMIN_EMAIL."); return; }
      const session = await getSession();
      if (session?.user?.role !== "SUPER_ADMIN") { setError("This account is not configured as a GillBill super admin."); return; }
      window.location.assign("/admin");
    } catch {
      setError("Could not reach the admin sign-in service. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-[1fr_1fr]"><section className="hidden flex-col justify-between bg-[#101b2d] p-12 text-white lg:flex"><Image src="/gillbill-logo.png" alt="GillBill Billing Software" width={180} height={74} unoptimized className="h-14 w-40 rounded-lg bg-white object-contain p-1" /><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Platform administration</p><h1 className="mt-3 max-w-md text-4xl font-bold">GillBill Super Admin</h1><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Approve business owners, confirm software sales, and manage subscription plans.</p></div><small className="text-slate-500">Restricted staff access</small></section><section className="flex items-center justify-center px-5 py-12"><form onSubmit={submit} className="w-full max-w-[390px]"><Link href="/login" className="mb-8 block text-sm font-semibold text-violet-700">← Customer sign in</Link><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">GillBill team</p><h2 className="mt-2 text-3xl font-bold">Super admin sign in</h2><p className="mt-2 text-sm text-slate-500">Use the configured platform administrator account.</p><label className="mt-8 block text-xs font-semibold text-slate-700">Admin email<input required type="email" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" /></label><label className="mt-4 block text-xs font-semibold text-slate-700">Password<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" /></label>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-violet-700 font-semibold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in to admin"}</button></form></section></main>;
}
