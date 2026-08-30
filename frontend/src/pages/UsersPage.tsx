import { useEffect, useState } from "react";
import { KeyRound, Trash2, Plus, Users } from "lucide-react";
import { api, type AppUser } from "../api";
import { UserFormModal } from "../components/UserFormModal";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { useConfirm } from "../components/ui/confirm-dialog";
import { useMe } from "../MeContext";

export function UsersPage() {
  const me = useMe();
  const confirm = useConfirm();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [resettingFor, setResettingFor] = useState<AppUser | null>(null);

  const load = () => api.users().then(setUsers);

  useEffect(() => {
    load();
  }, []);

  const remove = async (u: AppUser) => {
    if (!(await confirm({ title: `¿Eliminar a ${u.email}?`, description: "Esta acción no se puede deshacer.", destructive: true }))) return;
    await api.deleteUser(u.id);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Usuarios</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      {users?.length === 0 && (
        <EmptyState
          icon={Users}
          title="Solo tú por aquí"
          description="Añade un colaborador para que pueda entrar al panel."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Nuevo usuario
            </Button>
          }
        />
      )}

      {users && users.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>email</TableHead>
              <TableHead>rol</TableHead>
              <TableHead>creado</TableHead>
              <TableHead className="text-right">acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "ADMIN" ? "info" : "neutral"}>{u.role === "ADMIN" ? "administrador" : "colaborador"}</Badge>
                </TableCell>
                <TableCell className="text-slate-500">{new Date(u.createdAt).toLocaleDateString("es-ES")}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setResettingFor(u)} title="cambiar contraseña" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-indigo-300">
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={u.email === me.email}
                      title={u.email === me.email ? "no puedes eliminar tu propio usuario" : "eliminar"}
                      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {adding && <UserFormModal onClose={() => setAdding(false)} onSaved={load} />}
      {resettingFor && <ResetPasswordModal userId={resettingFor.id} email={resettingFor.email} onClose={() => setResettingFor(null)} />}
    </div>
  );
}
