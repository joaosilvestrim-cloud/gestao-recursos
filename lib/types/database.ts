export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type Seniority = 'junior' | 'pleno' | 'senior' | 'especialista' | 'lider';
export type AllocationType = 'percentage' | 'fixed_hours';
export type EntryType = 'billable' | 'non_billable' | 'absence' | 'idle';
export type TimesheetStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'collaborator' | 'project_manager' | 'pmo' | 'director';
export type SkillLevel = 'basico' | 'intermediario' | 'avancado' | 'especialista';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string | null;
  description: string | null;
  scope: string | null;
  started_at: string | null;
  estimated_end_at: string | null;
  actual_end_at: string | null;
  status: ProjectStatus;
  contract_value: number;
  budget_hours: number;
  budget_cost: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  started_at: string | null;
  estimated_end_at: string | null;
  actual_end_at: string | null;
  budget_hours: number;
  budget_cost: number;
  status: PhaseStatus;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Collaborator {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  department: string | null;
  seniority: Seniority | null;
  weekly_capacity_hours: number;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorCostHistory {
  id: string;
  collaborator_id: string;
  hourly_cost: number;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export interface Allocation {
  id: string;
  collaborator_id: string;
  project_id: string;
  phase_id: string | null;
  allocation_type: AllocationType;
  allocation_value: number;
  started_at: string;
  ended_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Timesheet {
  id: string;
  collaborator_id: string;
  project_id: string;
  phase_id: string | null;
  worked_date: string;
  hours: number;
  entry_type: EntryType;
  description: string | null;
  status: TimesheetStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectExpense {
  id: string;
  project_id: string;
  phase_id: string | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Views analíticas
export interface ProjectProfitability {
  project_id: string;
  project_name: string;
  contract_value: number;
  budget_hours: number;
  budget_cost: number;
  total_hours_consumed: number;
  total_labor_cost: number;
  total_expenses: number;
  total_cost: number;
  gross_margin: number;
  gross_margin_pct: number;
  budget_hours_consumed_pct: number;
}

export interface WeeklyUtilization {
  collaborator_id: string;
  name: string;
  role: string;
  department: string | null;
  week_start: string;
  capacity_hours: number;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  idle_hours: number;
  utilization_pct: number;
}
