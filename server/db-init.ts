import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDB, query, closeDB } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🔄 Initializing database...');
  await initDB();

  const sql = readFileSync(join(__dirname, 'init.sql'), 'utf-8');
  await query(sql);

  console.log('✅ Database schema created successfully.');
  await closeDB();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
