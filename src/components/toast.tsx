"use client";

import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const toast = useMemo(
    () => (text: string) => {
      setMessage(text);
      setOpen(true);
      window.setTimeout(() => setOpen(false), 2800);
    },
    [],
  );
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#101b2d] px-4 py-2 text-sm text-white shadow-lg transition ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
