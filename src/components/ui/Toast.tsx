"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { AgentAvatar } from "@/components/AgentAvatar";
import { useStyleVars } from "./StyleVars";

type ToastKind = "success" | "error";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const vars = useStyleVars();
  // Client-only mount gate so the portal isn't rendered during SSR (avoids a
  // hydration mismatch). Setting state once on mount is the intended pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div style={vars} className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-[var(--rule,#e4e4e7)] bg-[var(--card,#fff)] px-4 py-2.5 text-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] animate-[toast-in_160ms_ease]",
                  t.kind === "success" ? "text-[var(--ink,#18181b)]" : "text-red-600"
                )}
              >
                <AgentAvatar
                  state={t.kind === "success" ? "success" : "confused"}
                  size={15}
                  className="agv-intoast"
                />
                {t.message}
              </div>
            ))}
          </div>,
          document.body
        )}
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </ToastContext.Provider>
  );
}
