import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute'; // Naya Import
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { SettingsPage } from './pages/SettingsPage';
import { RiskCenter } from './pages/RiskCenter';
import { WalletsPage } from './pages/WalletsPage';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import { SendMoney } from './pages/SendMoney';
import { BulkPayout } from './pages/BulkPayout';
import LoginPage from './pages/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Public Route (Login) */}
        <Route path="/login" element={<LoginPage />} />

        {/* 2. Protected Routes (Layout ke saath) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
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
        </Route>

        {/* 3. Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}