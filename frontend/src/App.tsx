import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api, type Me } from "./api";
import { Login } from "./components/Login";
import { Layout } from "./components/Layout";
import { ProjectsListPage } from "./pages/ProjectsListPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { BackupsPage } from "./pages/BackupsPage";
import { UsersPage } from "./pages/UsersPage";
import { ServerPage } from "./pages/ServerPage";
import { TunnelsPage } from "./pages/TunnelsPage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { MeContext } from "./MeContext";
import { ClientsPage } from "./pages/ClientsPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { DatabaseDetailPage } from "./pages/DatabaseDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RecurringInvoicesPage } from "./pages/RecurringInvoicesPage";
import { ExpensesPage } from "./pages/ExpensesPage";

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = cargando

  const checkAuth = () => api.me().then(setMe).catch(() => setMe(null));

  useEffect(() => {
    checkAuth();
  }, []);

  if (me === undefined) return null;
  if (me === null) return <Login onLoggedIn={checkAuth} />;

  return (
    <MeContext.Provider value={me}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout me={me} onLogout={() => setMe(null)} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/proyectos" element={<ProjectsListPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/backups" element={<BackupsPage />} />
            <Route path="/servidor" element={<ServerPage />} />
            <Route path="/tuneles" element={<TunnelsPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/clientes/:id" element={<ClientDetailPage />} />
            <Route path="/facturas" element={<InvoicesPage />} />
            <Route path="/facturas/recurrentes" element={<RecurringInvoicesPage />} />
            <Route path="/facturas/:id" element={<InvoiceDetailPage />} />
            <Route path="/informes" element={<ReportsPage />} />
            <Route path="/gastos" element={<ExpensesPage />} />
            <Route path="/automatizaciones" element={<AutomationsPage />} />
            <Route path="/databases/:id" element={<DatabaseDetailPage />} />
            <Route path="/tareas" element={<TasksPage />} />
            <Route path="/horas" element={<TimeTrackingPage />} />
            {me.role === "ADMIN" && <Route path="/usuarios" element={<UsersPage />} />}
            {me.role === "ADMIN" && <Route path="/auditoria" element={<AuditLogPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MeContext.Provider>
  );
}
