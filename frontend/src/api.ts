async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `error ${res.status}`);
  }
  return res.json();
}

export interface Me {
  email: string;
  role: "ADMIN" | "COLLABORATOR";
  accessEmail: string | null;
}

export interface Service {
  id: string;
  name: string;
  containerName: string | null;
  branch: string | null;
  repoPath: string | null;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  hostname: string | null;
  composeFile: string;
  services: Service[];
}

export interface DeployEvent {
  id: string;
  branch: string;
  commitSha: string | null;
  status: string;
  trigger: string;
  log: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  role: "ADMIN" | "COLLABORATOR";
  createdAt: string;
}

export interface Snapshot {
  id: string;
  short_id: string;
  time: string;
  tags?: string[];
  paths: string[];
}

export type TargetType = "MYSQL" | "POSTGRES" | "PATH" | "CONTAINER_PATH" | "SQLITE";

export interface BackupTarget {
  id?: string;
  type: TargetType;
  containerName?: string | null;
  database?: string | null;
  username?: string | null;
  password?: string | null;
  containerPath?: string | null;
  hostPath?: string | null;
}

export interface BackupRun {
  id: string;
  status: string;
  trigger: string;
  log: string;
  startedAt: string;
  finishedAt: string | null;
}

export type RestoreMode = "new_database" | "overwrite" | "sibling";

export interface RestoreEvent {
  id: string;
  targetId: string;
  snapshotId: string;
  mode: RestoreMode;
  status: string;
  resultPath: string | null;
  log: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface BackupConfig {
  id: string;
  projectId: string;
  schedule: string;
  enabled: boolean;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  resticPath: string;
  targets: BackupTarget[];
  runs?: BackupRun[];
}

export interface CurrentMetrics {
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  diskUsedGB: number;
  diskTotalGB: number;
  loadAvg1: number;
  uptimeSeconds: number;
  cpuCount: number;
}

export interface MetricSample {
  id: string;
  timestamp: string;
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  diskUsedGB: number;
  diskTotalGB: number;
  loadAvg1: number;
}

export interface IngressRule {
  id?: string;
  hostname: string | null;
  service: string;
}

export interface Tunnel {
  id: string;
  cloudflareAccountId: string;
  name: string;
  tunnelId: string;
  containerName: string;
  dockerNetwork: string;
  ingressRules: IngressRule[];
}

export interface CloudflareAccount {
  id: string;
  name: string;
  accountId: string;
  hasApiToken: boolean;
  tunnels: Tunnel[];
}

export interface RemoteTunnel {
  id: string;
  name: string;
  status: string;
}

export type ServiceKind = "git" | "database" | "image";
export type DbEngine = "mysql" | "postgres";

export interface ServiceSpec {
  key: string;
  kind: ServiceKind;
  isPublic?: boolean;
  repoUrl?: string;
  branch?: string;
  engine?: DbEngine;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  image?: string;
  port?: number;
  env?: Record<string, string>;
}

export interface ScaffoldSpec {
  name: string;
  hostname?: string;
  services: ServiceSpec[];
  cloudflareAccountId?: string;
  enableBackups?: boolean;
}

export interface ScaffoldJob {
  id: string;
  name: string;
  status: string;
  log: string;
  projectId: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ProposalLineItem {
  id?: string;
  concept: string;
  quantity: number;
  unitPrice: number;
}

export interface Proposal {
  id: string;
  clientId: string;
  title: string;
  status: string;
  publicSlug: string | null;
  sourceType: "FOLDER" | "GITHUB" | null;
  sourcePath: string | null;
  sourceBranch: string | null;
  servedAt: string | null;
  emailSentAt: string | null;
  validUntil: string | null;
  notes: string | null;
  lineItems: ProposalLineItem[];
  client?: Client;
}

export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  province: string | null;
  country: string | null;
  status: string;
  notes: string | null;
  defaultHourlyRate: number | null;
  autoPaymentReminders: boolean;
  projectId: string | null;
  project?: Project | null;
  proposals: Proposal[];
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  businessName: string;
  taxId: string;
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  email: string;
  phone: string;
  bankAccount: string;
  defaultVatRate: number;
  invoiceNumberPrefix: string;
  nextInvoiceNumber: number;
}

export interface RecurringInvoice {
  id: string;
  clientId: string;
  client?: Client;
  concept: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  dayOfMonth: number;
  active: boolean;
  lastRunAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MonthlyRevenue {
  month: string;
  invoiced: number;
  paid: number;
  expenses: number;
}

export interface Expense {
  id: string;
  concept: string;
  amount: number;
  date: string;
  category: string;
  projectId: string | null;
  project?: Project | null;
  notes: string | null;
  createdAt: string;
}

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  paidTotal: number;
  pendingTotal: number;
  invoiceCount: number;
}

export interface SearchResult {
  type: "client" | "project" | "invoice" | "task" | "proposal" | "expense";
  id: string;
  label: string;
  sublabel?: string;
  link: string;
}

export interface DeliveryNote {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  concept: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  status: "PENDING" | "INVOICED";
  invoiceId: string | null;
  client?: Client;
  project?: Project | null;
  invoice?: { id: string; invoiceNumber: string | null } | null;
}

export interface InvoiceLineItem {
  id?: string;
  concept: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientId: string;
  issueDate: string;
  dueDate: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAt: string | null;
  emailSentAt: string | null;
  reminderSentAt: string | null;
  lineItems: InvoiceLineItem[];
  client?: Client;
  deliveryNotes?: DeliveryNote[];
}

export interface AppNotification {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export type NotificationConfigField =
  | { key: string; kind: "number"; label: string; unit?: string; default: number; min?: number; max?: number }
  | { key: string; kind: "projectMultiSelect"; label: string; default: string[] };

export interface NotificationPreference {
  type: string;
  label: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  configFields: NotificationConfigField[];
  enabled: boolean;
  emailEnabled: boolean;
  config: Record<string, number | string[]>;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  userRole: string;
  method: string;
  path: string;
  statusCode: number;
  body: string | null;
  createdAt: string;
}

export interface CronJob {
  id: string;
  name: string;
  url: string;
  method: "GET" | "POST" | "PUT";
  headers: string | null;
  body: string | null;
  schedule: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobRun {
  id: string;
  status: string;
  httpStatus: number | null;
  response: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface DatabaseRecord {
  id: string;
  projectId: string;
  label: string;
  engine: "MYSQL" | "POSTGRES";
  containerName: string;
  databaseName: string;
  username: string;
  password: string;
  project?: Project;
}

export interface QueryStat {
  query: string;
  execCount: number;
  avgTimeMs: number;
  totalTimeMs: number;
  rowsExamined: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  position: number;
  dueDate: string | null;
  assigneeId: string | null;
  assignee?: AppUser | null;
  clientId: string | null;
  client?: Client | null;
  projectId: string | null;
  project?: Project | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  user?: { id: string; email: string };
  clientId: string | null;
  client?: Client | null;
  projectId: string | null;
  project?: Project | null;
  taskId: string | null;
  task?: Task | null;
  description: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
  billable: boolean;
  hourlyRate: number | null;
  deliveryNoteId: string | null;
  deliveryNote?: DeliveryNote | null;
  createdAt: string;
}

export const api = {
  config: () => request<{ publicBaseUrl: string; smtpConfigured: boolean }>("/api/config"),
  login: (email: string, password: string) =>
    request<{ email: string; role: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request<Me>("/api/auth/me"),

  projects: () => request<Project[]>("/api/projects"),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  branches: (serviceId: string) =>
    request<{ branches: string[]; fetchError: string | null }>(`/api/services/${serviceId}/branches`),
  deploys: (serviceId: string) => request<DeployEvent[]>(`/api/services/${serviceId}/deploys`),
  deploy: (serviceId: string, branch: string) =>
    request<{ deployId: string }>(`/api/services/${serviceId}/deploy`, {
      method: "POST",
      body: JSON.stringify({ branch }),
    }),

  containerAction: (name: string, action: "start" | "stop" | "restart") =>
    request<{ ok: true }>(`/api/containers/${name}/${action}`, { method: "POST" }),

  users: () => request<AppUser[]>("/api/users"),
  usersBasic: () => request<{ id: string; email: string }[]>("/api/users/basic"),
  createUser: (email: string, password: string, role: "ADMIN" | "COLLABORATOR") =>
    request<AppUser>("/api/users", { method: "POST", body: JSON.stringify({ email, password, role }) }),
  deleteUser: (id: string) => request(`/api/users/${id}`, { method: "DELETE" }),
  setUserPassword: (id: string, password: string) =>
    request(`/api/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
  changeOwnPassword: (currentPassword: string, newPassword: string) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  backupConfig: (projectId: string) =>
    request<BackupConfig>(`/api/projects/${projectId}/backup-config`).catch(() => null),
  saveBackupConfig: (projectId: string, config: Omit<BackupConfig, "id" | "projectId">) =>
    request<BackupConfig>(`/api/projects/${projectId}/backup-config`, {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  deleteBackupConfig: (projectId: string) =>
    request(`/api/projects/${projectId}/backup-config`, { method: "DELETE" }),
  runBackupNow: (configId: string) => request(`/api/backup-configs/${configId}/run`, { method: "POST" }),
  backupRuns: (configId: string) => request<BackupRun[]>(`/api/backup-configs/${configId}/runs`),
  backupSnapshots: (configId: string) =>
    request<{ snapshots: Snapshot[] }>(`/api/backup-configs/${configId}/snapshots`),
  restore: (configId: string, targetId: string, snapshotId: string, mode: RestoreMode) =>
    request<{ restoreId: string }>(`/api/backup-configs/${configId}/restore`, {
      method: "POST",
      body: JSON.stringify({ targetId, snapshotId, mode }),
    }),
  restores: (configId: string) => request<RestoreEvent[]>(`/api/backup-configs/${configId}/restores`),

  currentMetrics: () => request<CurrentMetrics>("/api/metrics/current"),
  metricsHistory: (hours: number) => request<MetricSample[]>(`/api/metrics/history?hours=${hours}`),

  cfAccounts: () => request<CloudflareAccount[]>("/api/cloudflare/accounts"),
  createCfAccount: (name: string, accountId: string, apiToken?: string) =>
    request<CloudflareAccount>("/api/cloudflare/accounts", {
      method: "POST",
      body: JSON.stringify({ name, accountId, apiToken }),
    }),
  deleteCfAccount: (id: string) => request(`/api/cloudflare/accounts/${id}`, { method: "DELETE" }),
  remoteTunnels: (accountId: string) =>
    request<RemoteTunnel[]>(`/api/cloudflare/accounts/${accountId}/remote-tunnels`),

  tunnels: () => request<Tunnel[]>("/api/cloudflare/tunnels"),
  createTunnel: (data: {
    cloudflareAccountId: string;
    name: string;
    tunnelId: string;
    tunnelToken: string;
    containerName: string;
    dockerNetwork: string;
  }) => request<Tunnel>("/api/cloudflare/tunnels", { method: "POST", body: JSON.stringify(data) }),
  createTunnelViaApi: (accountId: string, name: string, containerName: string, dockerNetwork: string) =>
    request<Tunnel & { tunnelToken: string }>(`/api/cloudflare/accounts/${accountId}/create-tunnel`, {
      method: "POST",
      body: JSON.stringify({ name, containerName, dockerNetwork }),
    }),
  deleteTunnel: (id: string) => request(`/api/cloudflare/tunnels/${id}`, { method: "DELETE" }),
  syncTunnel: (id: string) => request<IngressRule[]>(`/api/cloudflare/tunnels/${id}/sync`, { method: "POST" }),
  saveIngress: (id: string, rules: IngressRule[]) =>
    request<{ rules: IngressRule[]; dnsWarnings: string[] }>(`/api/cloudflare/tunnels/${id}/ingress`, {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),

  scaffold: (spec: ScaffoldSpec) =>
    request<{ jobId: string }>("/api/scaffold", { method: "POST", body: JSON.stringify(spec) }),
  scaffoldJob: (id: string) => request<ScaffoldJob>(`/api/scaffold/${id}`),

  clients: () => request<Client[]>("/api/clients"),
  client: (id: string) => request<Client>(`/api/clients/${id}`),
  createClient: (data: Partial<Client>) =>
    request<Client>("/api/clients", { method: "POST", body: JSON.stringify(data) }),
  updateClient: (id: string, data: Partial<Client>) =>
    request<Client>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteClient: (id: string) => request(`/api/clients/${id}`, { method: "DELETE" }),

  proposals: () => request<Proposal[]>("/api/proposals"),
  proposal: (id: string) => request<Proposal>(`/api/proposals/${id}`),
  createProposal: (data: Partial<Proposal>) =>
    request<Proposal>("/api/proposals", { method: "POST", body: JSON.stringify(data) }),
  updateProposal: (id: string, data: Partial<Proposal>) =>
    request<Proposal>(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProposal: (id: string) => request(`/api/proposals/${id}`, { method: "DELETE" }),
  publishProposal: (id: string) => request(`/api/proposals/${id}/publish`, { method: "POST" }),
  sendProposalEmail: (id: string) => request<Proposal>(`/api/proposals/${id}/send-email`, { method: "POST" }),

  companySettings: () => request<CompanySettings>("/api/company-settings"),
  updateCompanySettings: (data: Partial<CompanySettings>) =>
    request<CompanySettings>("/api/company-settings", { method: "PATCH", body: JSON.stringify(data) }),

  deliveryNotes: (clientId?: string) =>
    request<DeliveryNote[]>(`/api/delivery-notes${clientId ? `?clientId=${clientId}` : ""}`),
  createDeliveryNote: (data: Partial<DeliveryNote>) =>
    request<DeliveryNote>("/api/delivery-notes", { method: "POST", body: JSON.stringify(data) }),
  updateDeliveryNote: (id: string, data: Partial<DeliveryNote>) =>
    request<DeliveryNote>(`/api/delivery-notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDeliveryNote: (id: string) => request(`/api/delivery-notes/${id}`, { method: "DELETE" }),

  invoices: (clientId?: string) => request<Invoice[]>(`/api/invoices${clientId ? `?clientId=${clientId}` : ""}`),
  invoice: (id: string) => request<Invoice>(`/api/invoices/${id}`),
  createInvoice: (data: { clientId: string; dueDate?: string; notes?: string; lineItems: InvoiceLineItem[] }) =>
    request<Invoice>("/api/invoices", { method: "POST", body: JSON.stringify(data) }),
  createInvoiceFromDeliveryNotes: (clientId: string, deliveryNoteIds: string[]) =>
    request<Invoice>("/api/invoices/from-delivery-notes", {
      method: "POST",
      body: JSON.stringify({ clientId, deliveryNoteIds }),
    }),
  updateInvoice: (id: string, data: Partial<Invoice>) =>
    request<Invoice>(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  confirmInvoice: (id: string) => request<Invoice>(`/api/invoices/${id}/confirm`, { method: "POST" }),
  deleteInvoice: (id: string) => request(`/api/invoices/${id}`, { method: "DELETE" }),
  sendInvoiceEmail: (id: string) => request<Invoice>(`/api/invoices/${id}/send-email`, { method: "POST" }),

  notifications: (unreadOnly?: boolean) =>
    request<AppNotification[]>(`/api/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
  unreadNotificationCount: () => request<{ count: number }>("/api/notifications/unread-count"),
  markNotificationRead: (id: string) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "POST" }),
  notificationPreferences: () => request<NotificationPreference[]>("/api/notification-preferences"),
  updateNotificationPreference: (
    type: string,
    data: { enabled: boolean; emailEnabled: boolean; config?: Record<string, number | string[]> }
  ) => request<NotificationPreference>(`/api/notification-preferences/${type}`, { method: "PUT", body: JSON.stringify(data) }),

  auditLogs: (filters?: { userEmail?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => v) as [string, string][]);
    const query = qs.toString();
    return request<AuditLog[]>(`/api/audit-logs${query ? `?${query}` : ""}`);
  },

  cronJobs: () => request<CronJob[]>("/api/cron-jobs"),
  createCronJob: (data: Partial<CronJob>) =>
    request<CronJob>("/api/cron-jobs", { method: "POST", body: JSON.stringify(data) }),
  updateCronJob: (id: string, data: Partial<CronJob>) =>
    request<CronJob>(`/api/cron-jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCronJob: (id: string) => request(`/api/cron-jobs/${id}`, { method: "DELETE" }),
  runCronJobNow: (id: string) => request<{ runId: string }>(`/api/cron-jobs/${id}/run`, { method: "POST" }),
  cronJobRuns: (id: string) => request<CronJobRun[]>(`/api/cron-jobs/${id}/runs`),

  databases: (projectId: string) => request<DatabaseRecord[]>(`/api/projects/${projectId}/databases`),
  database: (id: string) => request<DatabaseRecord>(`/api/databases/${id}`),
  createDatabase: (projectId: string, data: Partial<DatabaseRecord>) =>
    request<DatabaseRecord>(`/api/projects/${projectId}/databases`, { method: "POST", body: JSON.stringify(data) }),
  deleteDatabase: (id: string) => request(`/api/databases/${id}`, { method: "DELETE" }),
  databaseStats: (id: string) => request<{ stats: QueryStat[] }>(`/api/databases/${id}/stats`),
  resetDatabaseStats: (id: string) => request(`/api/databases/${id}/reset-stats`, { method: "POST" }),

  tasks: () => request<Task[]>("/api/tasks"),
  createTask: (data: Partial<Task>) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id: string) => request(`/api/tasks/${id}`, { method: "DELETE" }),

  timeEntries: (filters?: { userId?: string; clientId?: string; projectId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => v) as [string, string][]);
    const query = qs.toString();
    return request<TimeEntry[]>(`/api/time-entries${query ? `?${query}` : ""}`);
  },
  runningTimeEntry: () => request<TimeEntry | null>("/api/time-entries/running"),
  startTimeEntry: (data: {
    description: string;
    clientId?: string;
    projectId?: string;
    taskId?: string;
    billable?: boolean;
    hourlyRate?: number;
  }) => request<TimeEntry>("/api/time-entries/start", { method: "POST", body: JSON.stringify(data) }),
  stopTimeEntry: (id: string) => request<TimeEntry>(`/api/time-entries/${id}/stop`, { method: "POST" }),
  createTimeEntry: (data: {
    description: string;
    date: string;
    minutes: number;
    clientId?: string;
    projectId?: string;
    taskId?: string;
    billable?: boolean;
    hourlyRate?: number;
  }) => request<TimeEntry>("/api/time-entries", { method: "POST", body: JSON.stringify(data) }),
  updateTimeEntry: (id: string, data: Partial<TimeEntry> & { date?: string }) =>
    request<TimeEntry>(`/api/time-entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTimeEntry: (id: string) => request(`/api/time-entries/${id}`, { method: "DELETE" }),
  generateDeliveryNoteFromTime: (entryIds: string[], concept?: string) =>
    request<DeliveryNote>("/api/time-entries/generate-delivery-note", {
      method: "POST",
      body: JSON.stringify({ entryIds, concept }),
    }),

  monthlyRevenue: (months = 12) => request<MonthlyRevenue[]>(`/api/reports/monthly-revenue?months=${months}`),
  revenueByClient: () => request<ClientRevenue[]>("/api/reports/by-client"),

  search: (q: string) => request<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),

  recurringInvoices: () => request<RecurringInvoice[]>("/api/recurring-invoices"),
  createRecurringInvoice: (data: Partial<RecurringInvoice>) =>
    request<RecurringInvoice>("/api/recurring-invoices", { method: "POST", body: JSON.stringify(data) }),
  updateRecurringInvoice: (id: string, data: Partial<RecurringInvoice>) =>
    request<RecurringInvoice>(`/api/recurring-invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRecurringInvoice: (id: string) => request(`/api/recurring-invoices/${id}`, { method: "DELETE" }),

  expenses: (filters?: { from?: string; to?: string; projectId?: string }) => {
    const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => v) as [string, string][]);
    const query = qs.toString();
    return request<Expense[]>(`/api/expenses${query ? `?${query}` : ""}`);
  },
  createExpense: (data: Partial<Expense>) => request<Expense>("/api/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: string, data: Partial<Expense>) =>
    request<Expense>(`/api/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request(`/api/expenses/${id}`, { method: "DELETE" }),
};
