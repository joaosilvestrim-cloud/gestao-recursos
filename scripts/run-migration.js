const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não definida'); process.exit(1); }

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado ao PostgreSQL...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: applied } = await client.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) { console.log(`⏭  ${file} (já aplicada)`); continue; }
    console.log(`Executando: ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log(`✓ ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  if (ran === 0) console.log('\nBanco já está atualizado.');
  else console.log(`\n✅ ${ran} migration(s) aplicada(s)!`);
  await client.end();
}

runMigrations();
