import { db } from "../db.js";

export interface EmailTemplateVariable {
  key: string;
  description: string;
}

export interface EmailTemplateDef {
  key: string;
  label: string;
  description: string;
  variables: EmailTemplateVariable[];
  defaultSubject: string;
  defaultBody: string;
}

// Catálogo estático de los emails que envía la aplicación. Cada uno se renderiza con variables
// ya resueltas a texto plano/HTML simple (sin condicionales dentro de la plantilla) para no tener
// que montar un motor de plantillas: quien la edita solo sustituye {{variable}} por su valor.
export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: "invoice",
    label: "Factura / presupuesto",
    description: "Al pulsar \"Enviar por email\" en una factura confirmada o en un presupuesto (borrador).",
    variables: [
      { key: "saludo", description: "\"Hola Nombre\" si el cliente tiene contacto, o solo \"Hola\"" },
      { key: "documento", description: "frase natural: \"la factura 2026-0001\" o \"el presupuesto\"" },
      { key: "numero", description: "número de factura (vacío si es un presupuesto sin confirmar)" },
      { key: "empresa", description: "tu nombre / razón social (Datos fiscales)" },
      { key: "asunto_documento", description: "\"Factura 2026-0001\" o \"Presupuesto de Tu Empresa\", ya resuelto" },
    ],
    defaultSubject: "{{asunto_documento}}",
    defaultBody: "<p>{{saludo}},</p><p>Adjunto encontrarás {{documento}} solicitado.</p>",
  },
  {
    key: "proposal",
    label: "Propuesta comercial",
    description: "Al enviar el enlace de una propuesta publicada a un cliente.",
    variables: [
      { key: "saludo", description: "\"Hola Nombre\" si el cliente tiene contacto, o solo \"Hola\"" },
      { key: "titulo", description: "título de la propuesta" },
      { key: "enlace", description: "URL pública de la propuesta" },
      { key: "empresa", description: "tu nombre / razón social" },
    ],
    defaultSubject: "Propuesta: {{titulo}}",
    defaultBody: '<p>{{saludo}},</p><p>Aquí tienes la propuesta "{{titulo}}":</p><p><a href="{{enlace}}">{{enlace}}</a></p>',
  },
  {
    key: "payment_reminder",
    label: "Recordatorio de pago",
    description: "Automático, al cliente, cuando una de sus facturas vence sin cobrarse (solo si él lo tiene activado).",
    variables: [
      { key: "numero", description: "número de factura" },
      { key: "total", description: "importe total, formateado (ej. \"121.00 €\")" },
      { key: "vencimiento", description: "fecha de vencimiento, formateada" },
      { key: "empresa", description: "tu nombre / razón social" },
    ],
    defaultSubject: "Recordatorio de pago: Factura {{numero}}",
    defaultBody:
      "<p>Hola,</p><p>Te escribimos para recordarte que la factura {{numero}} ({{total}}) venció el {{vencimiento}} y todavía no consta como pagada.</p><p>Adjuntamos de nuevo la factura por si resulta útil. Gracias,<br/>{{empresa}}</p>",
  },
  {
    key: "notification",
    label: "Alerta interna",
    description: "A ti (o a quien tenga el email activado), para cualquier tipo de aviso: backup fallido, servicio caído, factura vencida, automatización rota...",
    variables: [
      { key: "titulo", description: "título del aviso" },
      { key: "mensaje", description: "cuerpo del aviso" },
      { key: "enlace_html", description: "enlace \"Ver en el panel\" ya resuelto a HTML, o vacío si no aplica" },
    ],
    defaultSubject: "[Portledger] {{titulo}}",
    defaultBody: "<p>{{mensaje}}</p>{{enlace_html}}",
  },
];

const CATALOG = new Map(EMAIL_TEMPLATES.map((t) => [t.key, t]));

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string>
): Promise<{ subject: string; html: string }> {
  const def = CATALOG.get(key);
  if (!def) throw new Error(`plantilla de email desconocida: ${key}`);
  const override = await db.emailTemplate.findUnique({ where: { key } });
  const subject = override?.subject || def.defaultSubject;
  const body = override?.body || def.defaultBody;
  return { subject: fill(subject, vars), html: fill(body, vars) };
}
