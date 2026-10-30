import fs from 'fs';
import { fileURLToPath } from 'node:url';
import { pg } from './db.js';

async function migrate() {
  const schemaPath = fileURLToPath(new URL('../modules/ledger/ledger.schema.sql', import.meta.url));
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pg.query(sql);
  console.log('✅ Migration done');
  await pg.end();
}

void migrate().catch((e) => { console.error(e); process.exit(1); });