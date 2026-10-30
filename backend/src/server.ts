import { app } from './app.js';
import dotenv from 'dotenv';
dotenv.config();
import './modules/reconciliation/worker.js';

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 http://localhost:${port}`));