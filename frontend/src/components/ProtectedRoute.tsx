import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  // Check if token exists in localStorage
  const token = localStorage.getItem('token');

  // Agar token nahi hai, toh login page pe redirect karo
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Agar token hai, toh andar ka component (Layout) render hone do
  return <Outlet />;
}