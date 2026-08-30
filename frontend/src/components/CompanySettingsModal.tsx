import { useEffect, useState } from "react";
import { api, type CompanySettings } from "../api";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export function CompanySettingsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.companySettings().then(setForm);
  }, []);

  const set = (patch: Partial<CompanySettings>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.updateCompanySettings(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none";

  return (
    <Modal
      onClose={onClose}
      title="Datos fiscales"
      description="Se usan para generar el PDF de tus facturas."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !form}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      {!form ? (
        <div className="space-y-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Nombre / razón social">
            <input value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="NIF / CIF">
              <input value={form.taxId} onChange={(e) => set({ taxId: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Email de contacto">
              <input value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <Field label="Dirección">
            <input value={form.address} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Código postal">
              <input value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Ciudad">
              <input value={form.city} onChange={(e) => set({ city: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Provincia">
              <input value={form.province} onChange={(e) => set({ province: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <Field label="IBAN (aparece en la factura como forma de pago)">
            <input value={form.bankAccount} onChange={(e) => set({ bankAccount: e.target.value })} className={inputClass} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="IVA por defecto (%)">
              <input type="number" value={form.defaultVatRate} onChange={(e) => set({ defaultVatRate: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Prefijo de factura">
              <input value={form.invoiceNumberPrefix} onChange={(e) => set({ invoiceNumberPrefix: e.target.value })} placeholder="ej. 2026-" className={inputClass} />
            </Field>
            <Field label="Próximo número">
              <input type="number" value={form.nextInvoiceNumber} onChange={(e) => set({ nextInvoiceNumber: Number(e.target.value) })} className={inputClass} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
