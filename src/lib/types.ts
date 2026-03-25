export type UserRole = 'admin' | 'accounting' | 'manager';
export const USER_ROLES: UserRole[] = ['admin', 'accounting', 'manager'];
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  accounting: 'Contabilidade',
  manager: 'Gestor',
};

export type InvoiceStatus =
  | 'uploaded'
  | 'processing'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type CostType = 'materials' | 'meals' | 'services' | 'other';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  vat_amount: number | null;
  currency: string;
  project_id: string | null;
  cost_type: CostType | null;
  status: InvoiceStatus;
  docupipe_id: string | null;
  docupipe_job_id: string | null;
  docupipe_raw: unknown | null;
  file_path: string | null;
  file_name: string | null;
  uploaded_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  project?: Project;
  invoice_lines?: InvoiceLine[];
  uploader?: Profile;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface DashboardFilters {
  project_id?: string;
  supplier_name?: string;
  date_from?: string;
  date_to?: string;
  uploaded_by?: string;
  cost_type?: CostType;
  status?: InvoiceStatus;
}

export const COST_TYPE_LABELS: Record<CostType, string> = {
  materials: 'Materiais',
  meals: 'Refeições',
  services: 'Serviços',
  other: 'Outros',
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  uploaded: 'Carregada',
  processing: 'A processar',
  pending_review: 'Pendente revisão',
  pending_approval: 'Pendente aprovação',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
