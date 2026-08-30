import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Server, Receipt, KanbanSquare, FileText } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { api, type SearchResult } from "../api";
import { cn } from "../lib/utils";

const TYPE_ICON: Record<SearchResult["type"], typeof Users> = {
  client: Users,
  project: Server,
  invoice: Receipt,
  task: KanbanSquare,
  proposal: FileText,
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  client: "cliente",
  project: "proyecto",
  invoice: "factura",
  task: "tarea",
  proposal: "propuesta",
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const setOpen = onOpenChange;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.search(query).then((r) => {
        setResults(r);
        setSelected(0);
      });
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  const go = (r: SearchResult) => {
    navigate(r.link);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      go(results[selected]);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[18%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 data-[state=open]:animate-fade-in"
        >
          <DialogPrimitive.Title className="sr-only">Buscar</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar clientes, proyectos, facturas, tareas, propuestas…"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
            <kbd className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">esc</kbd>
          </div>

          <div className="max-h-80 overflow-auto py-1.5">
            {query.trim().length >= 2 && results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-600">sin resultados</p>}
            {query.trim().length < 2 && <p className="px-4 py-6 text-center text-sm text-slate-600">escribe al menos 2 caracteres</p>}
            {results.map((r, i) => {
              const Icon = TYPE_ICON[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === selected ? "bg-indigo-500/10" : "hover:bg-slate-800/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", i === selected ? "text-indigo-300" : "text-slate-500")} />
                  <span className="flex-1 truncate text-sm text-slate-200">{r.label}</span>
                  {r.sublabel && <span className="shrink-0 truncate text-xs text-slate-600">{r.sublabel}</span>}
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    {TYPE_LABEL[r.type]}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
