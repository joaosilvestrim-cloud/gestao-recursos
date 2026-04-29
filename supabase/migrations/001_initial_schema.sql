-- ============================================================
-- SCHEMA COMPLETO: Sistema de Gestão de Portfólio e Projetos
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MÓDULO 1: GESTÃO DE PORTFÓLIO E PROJETOS
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT, -- CNPJ/CPF
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  description TEXT,
  scope TEXT,
  started_at DATE,
  estimated_end_at DATE,
  actual_end_at DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  contract_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  budget_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  budget_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ, -- soft delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RF-P03: Fases / Sprints / Pacotes de Trabalho (EAP/WBS)
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  started_at DATE,
  estimated_end_at DATE,
  actual_end_at DATE,
  budget_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  budget_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO 2: GESTÃO DE RECURSOS E ALOCAÇÃO
-- ============================================================

-- RF-R01: Colaboradores com custo H/H
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID, -- ligado ao auth.users do Supabase
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL, -- ex: Desenvolvedor, Designer, PM
  department TEXT,
  seniority TEXT CHECK (seniority IN ('junior', 'pleno', 'senior', 'especialista', 'lider')),
  weekly_capacity_hours NUMERIC(5, 2) NOT NULL DEFAULT 40,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RF-R01: Histórico de custo H/H para não afetar projetos passados
CREATE TABLE IF NOT EXISTS collaborator_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaborator_id UUID NOT NULL REFERENCES collaborators(id),
  hourly_cost NUMERIC(10, 2) NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE, -- NULL = vigente
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RF-R02: Skills / Competências
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collaborator_skills (
  collaborator_id UUID NOT NULL REFERENCES collaborators(id),
  skill_id UUID NOT NULL REFERENCES skills(id),
  level TEXT CHECK (level IN ('basico', 'intermediario', 'avancado', 'especialista')),
  PRIMARY KEY (collaborator_id, skill_id)
);

-- RF-R03: Alocação por projeto/fase com % ou horas fixas
CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaborator_id UUID NOT NULL REFERENCES collaborators(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase_id UUID REFERENCES project_phases(id),
  allocation_type TEXT NOT NULL DEFAULT 'percentage' CHECK (allocation_type IN ('percentage', 'fixed_hours')),
  allocation_value NUMERIC(5, 2) NOT NULL, -- 0-100 se % ou horas/semana
  started_at DATE NOT NULL,
  ended_at DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO 3: TIME-TRACKING E APONTAMENTO
-- ============================================================

-- RF-T01 + RF-T02: Registro de horas com classificação
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaborator_id UUID NOT NULL REFERENCES collaborators(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase_id UUID REFERENCES project_phases(id),
  worked_date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  entry_type TEXT NOT NULL DEFAULT 'billable' CHECK (entry_type IN ('billable', 'non_billable', 'absence', 'idle')),
  description TEXT,
  -- RF-T03: aprovação de timesheet
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES collaborators(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO 4: MOTOR FINANCEIRO E RENTABILIDADE
-- ============================================================

-- RF-F02: Despesas extras (não atreladas a horas)
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase_id UUID REFERENCES project_phases(id),
  category TEXT NOT NULL, -- ex: 'licenca', 'servidor', 'viagem', 'fornecedor'
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEGURANÇA: RBAC (perfis de acesso)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- auth.users
  collaborator_id UUID REFERENCES collaborators(id),
  role TEXT NOT NULL CHECK (role IN ('collaborator', 'project_manager', 'pmo', 'director')),
  project_id UUID REFERENCES projects(id), -- NULL = acesso global
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE ANALÍTICA
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_timesheets_project_date ON timesheets(project_id, worked_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_collaborator_date ON timesheets(collaborator_id, worked_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_allocations_collaborator ON allocations(collaborator_id, started_at, ended_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_allocations_project ON allocations(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_project ON project_expenses(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_history_collaborator ON collaborator_cost_history(collaborator_id, valid_from);

-- ============================================================
-- VIEWS ANALÍTICAS (RF-F01, RF-F03, RF-B01, RF-B02, RF-B03)
-- ============================================================

-- View: custo H/H vigente por colaborador
CREATE OR REPLACE VIEW v_collaborator_current_cost AS
SELECT
  c.id,
  c.name,
  c.role,
  c.department,
  c.seniority,
  c.weekly_capacity_hours,
  h.hourly_cost
FROM collaborators c
LEFT JOIN collaborator_cost_history h ON h.collaborator_id = c.id
  AND h.valid_from <= CURRENT_DATE
  AND (h.valid_until IS NULL OR h.valid_until >= CURRENT_DATE)
WHERE c.deleted_at IS NULL;

-- View: custo real por timesheet aprovado (RF-F01)
CREATE OR REPLACE VIEW v_timesheet_costs AS
SELECT
  t.id AS timesheet_id,
  t.project_id,
  t.phase_id,
  t.collaborator_id,
  t.worked_date,
  t.hours,
  t.entry_type,
  t.status,
  -- Custo H/H vigente na data do apontamento
  COALESCE((
    SELECT h.hourly_cost
    FROM collaborator_cost_history h
    WHERE h.collaborator_id = t.collaborator_id
      AND h.valid_from <= t.worked_date
      AND (h.valid_until IS NULL OR h.valid_until >= t.worked_date)
    ORDER BY h.valid_from DESC
    LIMIT 1
  ), 0) AS hourly_cost,
  t.hours * COALESCE((
    SELECT h.hourly_cost
    FROM collaborator_cost_history h
    WHERE h.collaborator_id = t.collaborator_id
      AND h.valid_from <= t.worked_date
      AND (h.valid_until IS NULL OR h.valid_until >= t.worked_date)
    ORDER BY h.valid_from DESC
    LIMIT 1
  ), 0) AS total_cost
FROM timesheets t
WHERE t.deleted_at IS NULL AND t.status = 'approved';

-- View: rentabilidade por projeto (RF-F03)
CREATE OR REPLACE VIEW v_project_profitability AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.contract_value,
  p.budget_hours,
  p.budget_cost,
  COALESCE(SUM(tc.hours), 0) AS total_hours_consumed,
  COALESCE(SUM(tc.total_cost), 0) AS total_labor_cost,
  COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0) AS total_expenses,
  COALESCE(SUM(tc.total_cost), 0) + COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0) AS total_cost,
  p.contract_value - (
    COALESCE(SUM(tc.total_cost), 0) +
    COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0)
  ) AS gross_margin,
  CASE
    WHEN p.contract_value > 0 THEN ROUND(
      (p.contract_value - (
        COALESCE(SUM(tc.total_cost), 0) +
        COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0)
      )) / p.contract_value * 100, 2)
    ELSE 0
  END AS gross_margin_pct,
  CASE WHEN p.budget_hours > 0
    THEN ROUND(COALESCE(SUM(tc.hours), 0) / p.budget_hours * 100, 2)
    ELSE 0
  END AS budget_hours_consumed_pct
FROM projects p
LEFT JOIN v_timesheet_costs tc ON tc.project_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.contract_value, p.budget_hours, p.budget_cost;

-- View: utilization rate semanal (RF-B02)
CREATE OR REPLACE VIEW v_weekly_utilization AS
SELECT
  c.id AS collaborator_id,
  c.name,
  c.role,
  c.department,
  DATE_TRUNC('week', t.worked_date)::DATE AS week_start,
  c.weekly_capacity_hours AS capacity_hours,
  COALESCE(SUM(t.hours), 0) AS total_hours,
  COALESCE(SUM(CASE WHEN t.entry_type = 'billable' THEN t.hours ELSE 0 END), 0) AS billable_hours,
  COALESCE(SUM(CASE WHEN t.entry_type = 'non_billable' THEN t.hours ELSE 0 END), 0) AS non_billable_hours,
  COALESCE(SUM(CASE WHEN t.entry_type IN ('absence', 'idle') THEN t.hours ELSE 0 END), 0) AS idle_hours,
  CASE WHEN c.weekly_capacity_hours > 0
    THEN ROUND(COALESCE(SUM(t.hours), 0) / c.weekly_capacity_hours * 100, 2)
    ELSE 0
  END AS utilization_pct
FROM collaborators c
LEFT JOIN timesheets t ON t.collaborator_id = c.id AND t.deleted_at IS NULL AND t.status = 'approved'
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.role, c.department, c.weekly_capacity_hours, DATE_TRUNC('week', t.worked_date);

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_phases_updated_at BEFORE UPDATE ON project_phases FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_collaborators_updated_at BEFORE UPDATE ON collaborators FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_allocations_updated_at BEFORE UPDATE ON allocations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_timesheets_updated_at BEFORE UPDATE ON timesheets FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON project_expenses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
