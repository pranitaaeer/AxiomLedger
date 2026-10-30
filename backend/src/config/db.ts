import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pg = new Pool({ connectionString: process.env.DATABASE_URL });
pg.on('error', (err) => console.error('PG pool error', err));