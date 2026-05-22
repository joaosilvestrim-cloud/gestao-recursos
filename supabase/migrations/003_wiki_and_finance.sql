-- ============================================================
-- MIGRATION 003: Wiki / Intranet + Finance KPI support
-- ============================================================

-- Wiki Categories
CREATE TABLE IF NOT EXISTS wiki_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📄',
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wiki Articles
CREATE TABLE IF NOT EXISTS wiki_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  category_id UUID REFERENCES wiki_categories(id),
  author_name TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'restricted')),
  edit_level TEXT NOT NULL DEFAULT 'everyone' CHECK (edit_level IN ('everyone', 'admin_only')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  views INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wiki Article Versions (history)
CREATE TABLE IF NOT EXISTS wiki_article_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  changed_by TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wiki Comments
CREATE TABLE IF NOT EXISTS wiki_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wiki_articles_category ON wiki_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_wiki_articles_slug ON wiki_articles(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_article_versions_article ON wiki_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_wiki_comments_article ON wiki_comments(article_id);

-- Seed default categories
INSERT INTO wiki_categories (name, icon, description, slug, order_index) VALUES
  ('Onboarding', '🚀', 'Guias para novos colaboradores — acesso a sistemas, processos e cultura.', 'onboarding', 1),
  ('Processos', '⚙️', 'Fluxos de trabalho, procedimentos operacionais e checklists.', 'processos', 2),
  ('Financeiro', '💰', 'Políticas financeiras, aprovações de despesas e regras de faturamento.', 'financeiro', 3),
  ('TI & Sistemas', '💻', 'Acesso a ferramentas, credenciais de ambiente e troubleshooting.', 'ti-sistemas', 4),
  ('RH & Benefícios', '👥', 'Política de férias, benefícios, avaliações e código de conduta.', 'rh-beneficios', 5),
  ('Projetos', '📁', 'Metodologia de projetos, templates e boas práticas de entrega.', 'projetos', 6)
ON CONFLICT (slug) DO NOTHING;

-- Finance: add revenue column to billing_milestones if not exists
-- (billing_milestones already has amount — no change needed)

-- View: monthly billing summary
CREATE OR REPLACE VIEW v_billing_summary AS
SELECT
  EXTRACT(YEAR FROM billed_at)::INTEGER AS year,
  EXTRACT(MONTH FROM billed_at)::INTEGER AS month,
  COUNT(*) AS milestones_billed,
  SUM(amount) AS revenue_billed
FROM billing_milestones
WHERE status = 'billed'
  AND billed_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 2 DESC;
