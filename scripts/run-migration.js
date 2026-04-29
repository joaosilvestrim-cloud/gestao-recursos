const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL...');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Executando: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`✓ ${file} executado com sucesso`);
    }

    console.log('\n✅ Todas as migrations executadas!');
  } catch (err) {
    console.error('Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
