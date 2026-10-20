"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SessionData = {
  user: { name?: string; role?: string } | null;
  memberships?: { business: { name: string; logoUrl?: string | null; restaurantEnabled: boolean; hotelEnabled: boolean }; branch?: { name: string } | null }[];
};

const links = [
  ["/dashboard", "Overview", "▦", "OWNER,MANAGER"],
  ["/pos", "POS Billing", "▣", "OWNER,MANAGER,CASHIER"],
  ["/orders", "Orders", "≋", "OWNER,MANAGER,CASHIER"],
  ["/products", "Products & menu", "◫", "OWNER,MANAGER,INVENTORY"],
  ["/categories", "Categories", "▧", "OWNER,MANAGER,INVENTORY"],
  ["/inventory", "Inventory", "▤", "OWNER,MANAGER,INVENTORY"],
  ["/purchases", "Purchases", "⇣", "OWNER,MANAGER,INVENTORY"],
  ["/customers", "Customers", "♙", "OWNER,MANAGER,CASHIER"],
  ["/suppliers", "Suppliers", "♧", "OWNER,MANAGER,INVENTORY"],
  ["/rooms", "Hotel / rooms", "⌂", "OWNER,MANAGER,HOUSEKEEPING"],
  ["/kitchen", "Kitchen display", "◉", "OWNER,MANAGER,KITCHEN,CASHIER"],
  ["/expenses", "Expenses", "−", "OWNER,MANAGER"],
  ["/staff", "Staff & permissions", "♧", "OWNER,MANAGER"],
  ["/reports", "Reports", "▥", "OWNER,MANAGER"],
  ["/printers", "Printers & devices", "▤", "OWNER,MANAGER"],
  ["/settings", "Business settings", "⚙", "OWNER"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const loadSession = () => { fetch("/api/session", { cache: "no-store" }).then((r) => r.json()).then(setSession).catch(() => setSession(null)); };
    loadSession();
    window.addEventListener("business-settings-updated", loadSession);
    return () => window.removeEventListener("business-settings-updated", loadSession);
  }, []);

  const user = session?.user;
  const membership = session?.memberships?.[0];
  const role = user?.role ?? "";
  const nav = links.filter(([href, , , roles]) => {
    if (!roles.split(",").includes(role)) return false;
    if (href === "/rooms" && !membership?.business.hotelEnabled) return false;
    if (href === "/kitchen" && !membership?.business.restaurantEnabled) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#1c2a3f]">
      {open && <button className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col bg-[#101b2d] px-4 py-5 text-slate-200 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-2">
          <Image src="/gillbill-logo.png" alt="GillBill Billing Software" width={160} height={66} priority unoptimized className="h-12 w-36 rounded-lg bg-white object-contain p-1" />
        </Link>
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          {membership?.business.logoUrl ? <Image src={membership.business.logoUrl} alt={`${membership.business.name} logo`} width={36} height={36} unoptimized className="h-9 w-9 rounded-lg bg-white object-contain" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-200 font-bold text-amber-900">{membership?.business.name?.slice(0, 1) ?? "S"}</span>}
          <span className="min-w-0"><b className="block truncate text-xs text-white">{membership?.business.name ?? "Your business"}</b><small className="text-[10px] text-slate-400">{membership?.branch?.name ?? "Main branch"}</small></span>
        </div>
        <small className="mb-2 px-3 text-[9px] font-bold tracking-[.16em] text-slate-500">WORKSPACE</small>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {nav.map(([href, label, icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs transition ${pathname === href ? "bg-[#293950] font-semibold text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}><span className="w-4 text-center text-base text-emerald-300">{icon}</span>{label}</Link>)}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-3 rounded-xl border border-white/10 bg-[#1b2a40] p-3"><b className="text-xs text-white">Need a hand?</b><p className="mt-1 text-[10px] leading-4 text-slate-400">Set up your catalog and start a sale from POS Billing.</p></div>
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-900">{user?.name?.slice(0, 1) ?? "U"}</span><span className="min-w-0 flex-1"><b className="block truncate text-[11px] text-white">{user?.name ?? "Signed in"}</b><small className="text-[10px] text-slate-400">{role.toLowerCase()}</small></span><button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10">Log out</button></div>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3"><button className="rounded border border-slate-200 px-2 py-1 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">☰</button><span className="text-[11px] text-slate-400">Workspace <span className="px-2">/</span><b className="text-slate-600">{nav.find((x) => x[0] === pathname)?.[1] ?? "Overview"}</b></span></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:block">{membership?.business.name}</span><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-900">{user?.name?.slice(0, 1) ?? "U"}</span></div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}

