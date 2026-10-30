import { BrowserRouter, Routes, Route, Navigate,} from 'react-router-dom';
import { Layout } from '../src/components/Layout';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from '../src/pages/TransactionsPage';
import { ReconciliationPage } from '../src/pages/ReconciliationPage';
import { SettingsPage } from '../src/pages/SettingsPage';
import { RiskCenter } from './pages/RiskCenter';
import { WalletsPage } from './pages/WalletsPage';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import { SendMoney } from './pages/SendMoney';
import { BulkPayout } from './pages/BulkPayout';
// import LoginPage from './pages/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* <Route path="login" element={<LoginPage />} /> */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reconciliation" element={<ReconciliationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="risk" element={<RiskCenter />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="transfers" element={<SendMoney />} />
          <Route path="bulk-payout" element={<BulkPayout />} />
          <Route path="bulk" element={<BulkPayout />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}