-- ============================================================
-- MIGRATION 002: Command Center Executivo
-- Sistema de Inteligência de Portfólio
-- ============================================================

-- Grupos empresariais (Eagles Group, IUNEX, Drive Data, Zenatur, Tambasa...)
CREATE TABLE IF NOT EXISTS account_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincular clientes a grupos
ALTER TABLE clients ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES account_groups(id);

-- Batches de importação CSV
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  filename TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  imported_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  error_log TEXT,
  period_month INT,
  period_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entradas de custo (CSV ou manual) — fonte primária de dados
-- total_cost = hours * hourly_cost OU amount_override (quando não há horas)
CREATE TABLE IF NOT EXISTS cost_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase_id UUID REFERENCES project_phases(id),
  collaborator_id UUID REFERENCES collaborators(id),
  collaborator_name TEXT,
  import_batch_id UUID REFERENCES import_batches(id),
  entry_date DATE NOT NULL,
  hours NUMERIC(8, 2),
  hourly_cost NUMERIC(10, 2),
  amount_override NUMERIC(15, 2),   -- valor fixo quando não há horas (ex: fornecedor)
  entry_type TEXT NOT NULL DEFAULT 'billable' CHECK (entry_type IN ('billable', 'non_billable', 'absence', 'idle')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv')),
  description TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custos indiretos / SGA rateados
CREATE TABLE IF NOT EXISTS indirect_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('sga', 'overhead', 'licenca', 'infraestrutura', 'comercial', 'outro')),
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL,
  rateio_scope TEXT NOT NULL DEFAULT 'global' CHECK (rateio_scope IN ('global', 'group', 'client', 'project')),
  project_id UUID REFERENCES projects(id),
  client_id UUID REFERENCES clients(id),
  group_id UUID REFERENCES account_groups(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Marcos de faturamento
CREATE TABLE IF NOT EXISTS billing_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  triggered_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'achieved', 'billed', 'overdue')),
  achieved_at DATE,
  billed_at DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline de vendas (Capacity Forecast)
CREATE TABLE IF NOT EXISTS pipeline_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  group_id UUID REFERENCES account_groups(id),
  probability_pct NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (probability_pct BETWEEN 0 AND 100),
  estimated_value NUMERIC(15, 2),
  estimated_hours NUMERIC(10, 2),
  expected_start DATE,
  expected_duration_months INT,
  required_roles TEXT,
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'proposal', 'negotiation', 'won', 'lost')),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cenários What-If
CREATE TABLE IF NOT EXISTS what_if_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  base_month INT,
  base_year INT,
  changes JSONB NOT NULL DEFAULT '[]',
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cost_entries_project ON cost_entries(project_id, entry_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_entries_collaborator ON cost_entries(collaborator_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_indirect_costs_period ON indirect_costs(period_year, period_month) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_milestones_project ON billing_milestones(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_billing_milestones_due ON billing_milestones(due_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_group ON clients(group_id);

-- ============================================================
-- HELPER: custo total de uma cost_entry
-- ============================================================
CREATE OR REPLACE FUNCTION fn_entry_total_cost(h NUMERIC, hc NUMERIC, ov NUMERIC)
RETURNS NUMERIC AS $$
  SELECT CASE WHEN ov IS NOT NULL THEN ov ELSE COALESCE(h, 0) * COALESCE(hc, 0) END;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- VIEWS EXECUTIVAS
-- ============================================================

CREATE OR REPLACE VIEW v_project_pl AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.status,
  p.contract_value AS revenue,
  p.budget_hours,
  p.budget_cost,
  p.started_at,
  p.estimated_end_at,
  c.id AS client_id,
  c.name AS client_name,
  ag.id AS group_id,
  ag.name AS group_name,
  COALESCE(SUM(ce.hours), 0) AS total_hours,
  COALESCE(SUM(fn_entry_total_cost(ce.hours, ce.hourly_cost, ce.amount_override)), 0) AS total_direct_cost,
  COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0) AS total_expenses,
  COALESCE((SELECT SUM(bm.amount) FROM billing_milestones bm WHERE bm.project_id = p.id AND bm.status = 'billed' AND bm.deleted_at IS NULL), 0) AS billed_amount,
  COALESCE((SELECT SUM(bm.amount) FROM billing_milestones bm WHERE bm.project_id = p.id AND bm.status IN ('pending','achieved') AND bm.deleted_at IS NULL), 0) AS pending_billing,
  p.contract_value
    - COALESCE(SUM(fn_entry_total_cost(ce.hours, ce.hourly_cost, ce.amount_override)), 0)
    - COALESCE((SELECT SUM(e.amount) FROM project_expenses e WHERE e.project_id = p.id AND e.deleted_at IS NULL), 0) AS gross_margin,
  CASE WHEN p.budget_hours > 0
    THEN ROUND(COALESCE(SUM(ce.hours), 0) / p.budget_hours * 100, 1) ELSE 0 END AS budget_hours_pct,
  CASE WHEN p.budget_cost > 0
    THEN ROUND(COALESCE(SUM(fn_entry_total_cost(ce.hours, ce.hourly_cost, ce.amount_override)), 0) / p.budget_cost * 100, 1) ELSE 0 END AS budget_cost_pct
FROM projects p
LEFT JOIN clients c ON c.id = p.client_id
LEFT JOIN account_groups ag ON ag.id = c.group_id
LEFT JOIN cost_entries ce ON ce.project_id = p.id AND ce.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.status, p.contract_value, p.budget_hours, p.budget_cost,
         p.started_at, p.estimated_end_at, c.id, c.name, ag.id, ag.name;

CREATE OR REPLACE VIEW v_client_pl AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  ag.id AS group_id,
  ag.name AS group_name,
  COUNT(DISTINCT pl.project_id) AS project_count,
  COALESCE(SUM(pl.revenue), 0) AS total_revenue,
  COALESCE(SUM(pl.total_direct_cost), 0) AS total_direct_cost,
  COALESCE(SUM(pl.total_expenses), 0) AS total_expenses,
  COALESCE(SUM(pl.gross_margin), 0) AS total_gross_margin,
  CASE WHEN COALESCE(SUM(pl.revenue), 0) > 0
    THEN ROUND(COALESCE(SUM(pl.gross_margin), 0) / SUM(pl.revenue) * 100, 1) ELSE 0 END AS gross_margin_pct,
  COALESCE(SUM(pl.total_hours), 0) AS total_hours,
  COALESCE(SUM(pl.billed_amount), 0) AS billed_amount,
  COALESCE(SUM(pl.pending_billing), 0) AS pending_billing
FROM clients c
LEFT JOIN account_groups ag ON ag.id = c.group_id
LEFT JOIN v_project_pl pl ON pl.client_id = c.id
WHERE c.active = TRUE
GROUP BY c.id, c.name, ag.id, ag.name;

CREATE OR REPLACE VIEW v_group_pl AS
SELECT
  ag.id AS group_id,
  ag.name AS group_name,
  COUNT(DISTINCT pl.client_id) AS client_count,
  COUNT(DISTINCT pl.project_id) AS project_count,
  COALESCE(SUM(pl.revenue), 0) AS total_revenue,
  COALESCE(SUM(pl.total_direct_cost), 0) AS total_direct_cost,
  COALESCE(SUM(pl.total_expenses), 0) AS total_expenses,
  COALESCE(SUM(pl.gross_margin), 0) AS total_gross_margin,
  CASE WHEN COALESCE(SUM(pl.revenue), 0) > 0
    THEN ROUND(COALESCE(SUM(pl.gross_margin), 0) / SUM(pl.revenue) * 100, 1) ELSE 0 END AS gross_margin_pct,
  COALESCE(SUM(pl.billed_amount), 0) AS billed_amount,
  COALESCE(SUM(pl.pending_billing), 0) AS pending_billing
FROM account_groups ag
LEFT JOIN clients c ON c.group_id = ag.id
LEFT JOIN v_project_pl pl ON pl.client_id = c.id
WHERE ag.active = TRUE
GROUP BY ag.id, ag.name;

CREATE OR REPLACE VIEW v_billing_alerts AS
SELECT
  bm.id,
  bm.project_id,
  p.name AS project_name,
  c.name AS client_name,
  bm.name AS milestone_name,
  bm.amount,
  bm.due_date,
  bm.status,
  bm.triggered_by,
  CURRENT_DATE - bm.due_date AS days_overdue,
  CASE
    WHEN bm.status = 'achieved'                                   THEN 'ready_to_bill'
    WHEN bm.due_date < CURRENT_DATE AND bm.status = 'pending'    THEN 'overdue'
    WHEN bm.due_date <= CURRENT_DATE + 7 AND bm.status = 'pending' THEN 'due_soon'
    ELSE 'on_track'
  END AS alert_type
FROM billing_milestones bm
JOIN projects p ON p.id = bm.project_id
LEFT JOIN clients c ON c.id = p.client_id
WHERE bm.deleted_at IS NULL AND bm.status != 'billed'
ORDER BY bm.due_date ASC;

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_account_groups_updated_at    BEFORE UPDATE ON account_groups    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_cost_entries_updated_at      BEFORE UPDATE ON cost_entries      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_indirect_costs_updated_at    BEFORE UPDATE ON indirect_costs    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_billing_milestones_updated_at BEFORE UPDATE ON billing_milestones FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_pipeline_updated_at          BEFORE UPDATE ON pipeline_projects FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_what_if_updated_at           BEFORE UPDATE ON what_if_scenarios FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
