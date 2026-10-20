"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense,useState } from "react";

function ResetForm(){const params=useSearchParams();const token=params.get("token")||"";const [message,setMessage]=useState("");async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const password=String(new FormData(e.currentTarget).get("password")||"");const r=await fetch("/api/password/reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});const d=await r.json();setMessage(r.ok?"Password updated. You can sign in now.":d.error||"This reset link is invalid or has expired.")};return <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8"><h1 className="font-[Manrope] text-2xl font-bold">Choose a new password</h1><input required minLength={8} name="password" type="password" className="mt-6 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="At least 8 characters"/><button className="mt-4 h-11 w-full rounded-lg bg-emerald-700 font-semibold text-white">Save password</button>{message&&<p className="mt-4 text-sm text-slate-600">{message}</p>}<Link href="/login" className="mt-5 block text-center text-sm font-semibold text-emerald-700">Sign in</Link></form>}
export default function ResetPasswordPage(){return <main className="grid min-h-screen place-items-center bg-[#f4f6fa] p-4"><Suspense><ResetForm/></Suspense></main>}
