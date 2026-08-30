import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, Download, ScrollText, X } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "../lib/utils";

const LINE_OPTIONS = [200, 500, 1000, 2000] as const;

function lineTone(line: string): string {
  if (/\b(error|fail(ed)?|exception|fatal)\b/i.test(line)) return "text-red-400";
  if (/\b(warn(ing)?)\b/i.test(line)) return "text-amber-400";
  return "text-emerald-400/90";
}

export function LogViewer({ containerName, onClose }: { containerName: string; onClose: () => void }) {
  const [allLines, setAllLines] = useState<string[]>([]);
  const [maxLines, setMaxLines] = useState<(typeof LINE_OPTIONS)[number]>(500);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource(`/api/containers/${containerName}/logs`, { withCredentials: true });
    source.onmessage = (e) => setAllLines((prev) => [...prev.slice(-4000), e.data]);
    source.onerror = () => source.close();
    return () => source.close();
  }, [containerName]);

  const lines = useMemo(() => allLines.slice(-maxLines), [allLines, maxLines]);

  useEffect(() => {
    if (autoScroll) boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [lines, autoScroll]);

  const fullText = lines.join("\n");

  const copyAll = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${containerName}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" onClose={onClose} className="!max-w-[92vw] p-0">
        <div className="flex h-[82vh] flex-col overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2.5">
              <ScrollText className="h-4 w-4 text-slate-500" />
              <span className="font-mono text-slate-200">{containerName}</span>
              <select
                value={maxLines}
                onChange={(e) => setMaxLines(Number(e.target.value) as (typeof LINE_OPTIONS)[number])}
                className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none"
              >
                {LINE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    últimas {n}
                  </option>
                ))}
              </select>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">{lines.length} líneas</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-slate-400">
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-indigo-500" />
                autoscroll
              </label>
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-slate-300 transition-colors hover:bg-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "copiado" : "copiar"}
              </button>
              <button
                onClick={download}
                className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-slate-300 transition-colors hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" /> descargar
              </button>
              <button onClick={onClose} className="ml-1 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div ref={boxRef} className="flex-1 overflow-auto bg-[#08090c] font-mono text-xs leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.03]">
                <span className="w-12 shrink-0 select-none border-r border-slate-900 px-2 py-0.5 text-right text-slate-700">{i + 1}</span>
                <span className={cn("whitespace-pre-wrap px-3 py-0.5", lineTone(line))}>{line}</span>
              </div>
            ))}
            {lines.length === 0 && <div className="px-3 py-2 text-slate-600">esperando logs…</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
