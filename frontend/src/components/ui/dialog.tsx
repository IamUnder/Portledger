import { type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  size = "md",
  onClose,
}: {
  className?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  onClose?: () => void;
}) {
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 data-[state=open]:animate-fade-in",
          "max-h-[88vh] overflow-auto",
          widths[size],
          className
        )}
      >
        {children}
        <DialogPrimitive.Close
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-800 px-6 py-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold text-slate-100", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("mt-1 text-xs text-slate-500", className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4", className)} {...props} />;
}

// Envoltorio de conveniencia: se monta ya "abierto" y se desmonta al cerrar, igual que el
// patrón `{editing !== undefined && <FooModal .../>}` usado en toda la app — así cada modal
// gana foco atrapado/escape/click-fuera de Radix sin tener que aprender su API compuesta.
export function Modal({
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  className,
}: {
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size={size} onClose={onClose} className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <DialogBody>{children}</DialogBody>}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
