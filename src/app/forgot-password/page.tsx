"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [message,setMessage]=useState(""); const [url,setUrl]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const identifier=String(new FormData(e.currentTarget).get("identifier")||"");const r=await fetch("/api/password/forgot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier})});const d=await r.json();setMessage(d.message||"If an account exists, a reset link was generated.");setUrl(d.demoResetUrl||"")}
  return <main className="grid min-h-screen place-items-center bg-[#f4f6fa] p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Account help</p><h1 className="mt-2 font-[Manrope] text-2xl font-bold">Reset your password</h1><p className="mt-2 text-sm text-slate-500">Enter your account email or mobile number.</p><input required name="identifier" className="mt-6 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Email or mobile number"/><button className="mt-4 h-11 w-full rounded-lg bg-emerald-700 text-sm font-semibold text-white">Request reset link</button>{message&&<p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{message}{url&&<><br/><Link className="mt-2 inline-block underline" href={url}>Open development reset link</Link></>}</p>}<p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-emerald-700">Back to sign in</Link></p></form></main>;
}
