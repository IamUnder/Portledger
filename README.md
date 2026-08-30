# Portledger

Panel de control DevOps + CRM ligero, autoalojado, para quien gestiona unos pocos proyectos
Docker propios o de clientes desde un único servidor (tipo homelab o VPS pequeño). No es un
PaaS genérico ni pretende sustituir a Dokploy/Coolify para despliegues a gran escala — está
pensado para el caso de "tengo 1-5 proyectos reales, quiero verlos, desplegarlos, respaldarlos
y facturar el trabajo que hago sobre ellos, todo desde el mismo sitio".

## Qué incluye

- **Proyectos**: alta desde un asistente (repo Git, base de datos, imagen suelta), estado en
  vivo de cada contenedor, logs en streaming, deploy por rama con historial.
- **Backups**: por proyecto, a Google Drive vía restic/rclone, con retención configurable y
  restauración desde la propia interfaz.
- **Servidor**: CPU/RAM/disco en vivo e histórico.
- **Túneles**: gestión de Cloudflare Tunnels multi-cuenta, con DNS automático al publicar.
- **Clientes / Propuestas / Facturas**: propuestas publicables como mini-webs, albaranes,
  facturación con numeración fiscal secuencial, envío por email, PDF.
- **Registro de horas**: cronómetro o entrada manual, con conversión directa a albarán/factura.
- **Tareas**: tablero Kanban con filtros por asignado/proyecto/prioridad.
- **Notificaciones**: catálogo de alertas (backup fallido, servicio caído, factura vencida,
  recursos altos...) configurable por usuario, con email opcional.
- **Auditoría**: registro de qué usuario hizo qué acción y cuándo.
- **Bases de datos**: monitorización de queries más lentas/frecuentes (MySQL y Postgres).

## Stack

Fastify + Prisma + SQLite (backend) · React + Vite + Tailwind + Radix (frontend) · Docker
Compose para todo, incluido el propio panel.

## Requisitos

- Un host con Docker y Docker Compose instalados.
- El panel se ejecuta como dos contenedores (`backend`, `frontend`) y necesita acceso al socket
  de Docker del host para gestionar el resto de tus proyectos.
- Opcional: [restic](https://restic.net/) y [rclone](https://rclone.org/) instalados en el host
  (en `~/.local/bin`, sin necesidad de sudo) si quieres usar el módulo de Backups.
- Opcional: una cuenta de Cloudflare si quieres gestionar túneles desde el panel.
- Opcional: credenciales SMTP si quieres envío de facturas/propuestas y notificaciones por email.

## Puesta en marcha

```bash
git clone <este-repo> panel
cd panel
cp .env.example .env
```

Edita `.env`: como mínimo, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `HOST_HOME` (la ruta absoluta de tu
`$HOME` en el host, tal cual la ve Docker — normalmente `/home/tu-usuario`). El resto de
variables son opcionales y están documentadas en el propio `.env.example`. Si clonas el repo en
una carpeta con otro nombre (no `panel`), añade también `PANEL_HOST_DIR` apuntando a esa ruta.

```bash
docker compose up -d --build
```

Entra en `http://<ip-del-host>:8082` (o el puerto que hayas puesto en `PANEL_LAN_PORT`) con el
`ADMIN_EMAIL`/`ADMIN_PASSWORD` que pusiste en `.env`. No hay datos de ejemplo precargados: la
base de datos arranca vacía salvo por ese usuario admin.

### Primeros pasos dentro del panel

1. **Nuevo proyecto** (sidebar → Proyectos) para dar de alta el primero, vía el asistente.
2. Si ya tenías proyectos Docker corriendo **antes** de instalar el panel y quieres que
   Automatizaciones o el estado de bases de datos lleguen a ellos, copia
   `docker-compose.override.yml.example` a `docker-compose.override.yml` y añade sus redes
   Docker externas (`docker network ls` para ver los nombres reales), luego
   `docker compose up -d` otra vez. Los proyectos que crees desde el asistente no necesitan
   esto: se conectan solos.
3. **Túneles** → añade tu cuenta de Cloudflare si quieres exponer proyectos a internet desde
   el panel.
4. **Facturas** → "Datos fiscales" para poner tu nombre/NIF/IBAN reales antes de facturar nada.

## Notas de arquitectura

- Todo el estado vive en una única base SQLite (`data/panel.db`, montada como volumen — no se
  versiona). Respáldala igual que cualquier otro dato importante; el propio panel puede
  respaldarse a sí mismo si configuras un backup para su propio "proyecto" desde la interfaz.
- `docker-compose.yml` es la base genérica; `docker-compose.override.yml` (no versionado) es el
  sitio para todo lo específico de tu servidor (redes externas, ajustes puntuales). Docker
  Compose los combina solo, sin flags extra.
- El backend necesita el socket de Docker y ver el mismo `$HOME` del host (bind-mount) para
  poder desplegar/inspeccionar tus otros proyectos — no hay forma de evitar esto dado lo que
  hace la app.

## Seguridad

- Cambia `ADMIN_PASSWORD` por algo largo antes de exponer el panel a internet.
- Si expones el panel públicamente, ponlo detrás de un reverse proxy con TLS (el
  `docker-compose.yml` incluye un ejemplo de labels de Traefik) y considera añadir Cloudflare
  Access u otra capa de autenticación delante.
- Ningún secreto (`.env`, `data/`, `docker-compose.override.yml`) se versiona — revísalo antes
  de hacer commit si has tocado esos ficheros.

## Licencia

MIT — ver [LICENSE](./LICENSE). Úsalo, modifícalo y despliégalo libremente.
