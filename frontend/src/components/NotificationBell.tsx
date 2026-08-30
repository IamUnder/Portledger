import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings2, CheckCheck } from "lucide-react";
import { api, type AppNotification } from "../api";
import { NotificationPreferencesModal } from "./NotificationPreferencesModal";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-indigo-400",
  WARNING: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export function NotificationBell({ placement = "up" }: { placement?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [count, setCount] = useState(0);
  const [showPrefs, setShowPrefs] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const refreshCount = () => api.unreadNotificationCount().then((r) => setCount(r.count));

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!open) api.notifications().then(setItems);
    setOpen((o) => !o);
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      await api.markNotificationRead(n.id);
      refreshCount();
      setItems((arr) => arr.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    }
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setItems((arr) => arr.map((i) => ({ ...i, read: true })));
    setCount(0);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={toggleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors duration-200 hover:bg-slate-800/60 hover:text-slate-100"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          className={cn(
            "animate-fade-in absolute z-30 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50",
            placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">Notificaciones</span>
            <div className="flex items-center gap-1">
              {items.some((i) => !i.read) && (
                <button
                  onClick={markAllRead}
                  title="marcar todas leídas"
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setShowPrefs(true)}
                title="configurar notificaciones"
                className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-600">sin notificaciones</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "block w-full border-b border-slate-800/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-800/50",
                  n.read && "opacity-50"
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity]}`} />
                  <span className="text-sm text-slate-200">{n.title}</span>
                  {!n.read && <Badge variant="info" className="ml-auto px-1.5 py-0 text-[10px]">nueva</Badge>}
                </div>
                <p className="mb-1 text-xs text-slate-500">{n.message}</p>
                <span className="text-[11px] text-slate-600">{timeAgo(n.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {showPrefs && <NotificationPreferencesModal onClose={() => setShowPrefs(false)} />}
    </div>
  );
}
