import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  Archive,
  Cpu,
  Network,
  Users,
  KanbanSquare,
  Clock,
  Receipt,
  Zap,
  UserCog,
  ScrollText,
  KeyRound,
  LogOut,
  ChevronsUpDown,
  Anchor,
  BarChart3,
  Search,
  Menu,
  X,
  Wallet,
  Mail,
} from "lucide-react";
import { api, type Me } from "../api";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { NotificationBell } from "./NotificationBell";
import { CommandPalette } from "./CommandPalette";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: typeof Server; end?: boolean }[] }[] = [
  { label: "General", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    label: "Infraestructura",
    items: [
      { to: "/proyectos", label: "Proyectos", icon: Server },
      { to: "/backups", label: "Backups", icon: Archive },
      { to: "/servidor", label: "Servidor", icon: Cpu },
      { to: "/tuneles", label: "Túneles", icon: Network },
    ],
  },
  {
    label: "Gestión",
    items: [
      { to: "/tareas", label: "Tareas", icon: KanbanSquare },
      { to: "/horas", label: "Horas", icon: Clock },
    ],
  },
  {
    label: "Negocio",
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/facturas", label: "Facturas", icon: Receipt },
      { to: "/informes", label: "Informes", icon: BarChart3 },
      { to: "/gastos", label: "Gastos", icon: Wallet },
      { to: "/automatizaciones", label: "Automatizaciones", icon: Zap },
    ],
  },
];

const ADMIN_ITEMS = [
  { to: "/usuarios", label: "Usuarios", icon: UserCog },
  { to: "/auditoria", label: "Auditoría", icon: ScrollText },
  { to: "/plantillas", label: "Plantillas de email", icon: Mail },
];

export function Layout({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const initials = me.email.slice(0, 2).toUpperCase();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
      isActive ? "bg-indigo-500/10 text-indigo-300 shadow-[inset_2px_0_0_0] shadow-indigo-400" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
    );

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200 lg:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-3 py-2.5 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white">
            <Anchor className="h-3 w-3" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold text-slate-100">Portledger</span>
        </div>
        <NotificationBell placement="down" />
      </header>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] shrink-0 -translate-x-full flex-col border-r border-slate-800/80 bg-slate-900 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:bg-slate-900/40",
          mobileOpen && "translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
              <Anchor className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none tracking-wide text-slate-100">Portledger</div>
              <div className="text-[11px] text-slate-600">centro de operaciones</div>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar…
            <kbd className="ml-auto hidden rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {me.role === "ADMIN" && (
            <div>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Administración</div>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="flex items-center gap-1 border-t border-slate-800/80 px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{me.email}</div>
                  <div className="text-[11px] text-slate-600">{me.role === "ADMIN" ? "administrador" : "colaborador"}</div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={() => setChangingPassword(true)}>
                <KeyRound className="h-4 w-4" /> Cambiar contraseña
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-300"
                onClick={async () => {
                  await api.logout();
                  onLogout();
                }}
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
