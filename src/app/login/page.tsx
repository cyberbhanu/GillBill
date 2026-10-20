"use client";

import Link from "next/link";
import Image from "next/image";
import { getSession, signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const accountPendingApproval = params.get("created") === "pending-approval";
  const { data: session, status } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(session?.user?.businessId ? "/dashboard" : "/onboarding");
  }, [status, session, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await signIn("credentials", { identifier: identifier.trim(), password, redirect: false });
      if (!result?.ok || result.error) { setError("Sign in failed. Use the same email/mobile and password you used when creating the account."); return; }

      const signedInSession = await getSession();
      if (!signedInSession?.user) {
        setError("Your sign in was accepted, but GillBill could not start a session. Refresh the page and try again.");
        return;
      }

      const requestedPath = params.get("from");
      const safeRequestedPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : null;
      const destination = signedInSession.user.role === "SUPER_ADMIN" ? "/admin" : signedInSession.user.businessId ? safeRequestedPath || "/dashboard" : "/onboarding";
      window.location.assign(destination);
    } catch {
      setError("GillBill could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]"><section className="hidden flex-col justify-between bg-[#101b2d] p-12 text-white lg:flex"><Link href="/" className="flex items-center gap-3 text-lg font-extrabold"><Image src="/gillbill-logo.png" alt="GillBill Billing Software" width={180} height={74} unoptimized className="h-14 w-40 rounded-lg bg-white object-contain p-1" /></Link><div className="max-w-lg"><p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Your business, in sync</p><h1 className="font-[Manrope] text-4xl font-bold leading-tight">A clearer way to run your counter.</h1><p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Billing, products, stock, and business activity in one calm workspace.</p></div><small className="text-slate-500">GillBill POS · Business suite</small></section><section className="flex items-center justify-center px-5 py-12"><form onSubmit={submit} className="w-full max-w-[390px]"><Link href="/" className="mb-10 flex items-center gap-3 text-lg font-extrabold lg:hidden"><Image src="/gillbill-logo.png" alt="GillBill Billing Software" width={160} height={66} unoptimized className="h-12 w-36 rounded-lg bg-white object-contain p-1" /></Link><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Welcome back</p><h2 className="mt-2 font-[Manrope] text-3xl font-bold">Sign in to your account</h2><p className="mt-2 text-sm text-slate-500">Enter your account details to continue.</p>{accountPendingApproval && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Your owner account is waiting for GillBill admin approval. You can sign in after it is approved.</p>}<label className="mt-8 block text-xs font-semibold text-slate-700">Email or mobile number<input required autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" /></label><label className="mt-4 block text-xs font-semibold text-slate-700">Password<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" /></label>{error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<div className="mt-4 text-right"><Link href="/forgot-password" className="text-xs font-semibold text-emerald-700">Forgot password?</Link></div><button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-emerald-700 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{busy?"Signing in…":"Sign in"}</button><p className="mt-6 text-center text-sm text-slate-500">New to GillBill? <Link href="/register" className="font-semibold text-emerald-700">Create an account</Link></p></form></section></main>;
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }




