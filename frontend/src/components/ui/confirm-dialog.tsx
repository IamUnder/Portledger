import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "./dialog";
import { Button } from "./button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() usado fuera de ConfirmProvider");
  return ctx;
}

// Sustituye a window.confirm() por un modal coherente con el resto de la app. Se usa como
// `if (!(await confirm({ title: "..." }))) return;` — mismo patrón, sin bloquear el hilo del navegador.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolveRef.current?.(value);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal
          onClose={() => settle(false)}
          title={options.title}
          description={options.description}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Cancelar"}
              </Button>
              <Button variant={options.destructive ? "destructive" : "default"} onClick={() => settle(true)} autoFocus>
                {options.confirmLabel ?? "Eliminar"}
              </Button>
            </>
          }
        />
      )}
    </ConfirmContext.Provider>
  );
}
