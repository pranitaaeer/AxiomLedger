import { app } from './app.js';
import dotenv from 'dotenv';
dotenv.config();
import './modules/reconciliation/worker.js';
import { seedDefaultAdmin } from './modules/auth/auth.service.js';

const port = process.env.PORT || 4000;
seedDefaultAdmin().then(() => {
  app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
});