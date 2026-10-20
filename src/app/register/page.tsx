"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Unable to create your account."); return; }
    router.push("/login?created=1");
  }
  return <main className="grid min-h-screen bg-white lg:grid-cols-[1fr_1fr]"><section className="hidden flex-col justify-between bg-[#101b2d] p-12 text-white lg:flex"><Link href="/login" className="inline-flex w-fit"><Image src="/gillbill-logo.png" alt="GillBill Billing Software" width={180} height={74} unoptimized className="h-14 w-40 rounded-lg bg-white object-contain p-1" /></Link><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Get started</p><h1 className="mt-3 max-w-md font-[Manrope] text-4xl font-bold">Your first step toward a smoother workday.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Create an owner account, then configure your business and branch.</p></div><small className="text-slate-500">Secure account setup</small></section><section className="flex items-center justify-center px-5 py-10"><form onSubmit={submit} className="w-full max-w-[400px]"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Owner account</p><h2 className="mt-2 font-[Manrope] text-3xl font-bold">Create your account</h2><p className="mt-2 text-sm text-slate-500">Use an email, mobile number, or both.</p><label className="mt-7 block text-xs font-semibold">Your name<input name="name" required minLength={2} autoComplete="name" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="mt-4 block text-xs font-semibold">Email address<input name="email" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="mt-4 block text-xs font-semibold">Mobile number<input name="phone" type="tel" autoComplete="tel" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="mt-4 block text-xs font-semibold">Password<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" /><small className="mt-1 block text-slate-400">At least 8 characters</small></label>{error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-emerald-700 font-semibold text-white disabled:opacity-60">{busy?"Creating account…":"Create account"}</button><p className="mt-5 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-semibold text-emerald-700">Sign in</Link></p></form></section></main>;
}




