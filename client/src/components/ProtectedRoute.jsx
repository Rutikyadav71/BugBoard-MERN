import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

// Usage: <ProtectedRoute /> guards authentication; <ProtectedRoute roles={['Admin']} /> also guards role.
// This is a UX guard only. The backend is the real authority and re-checks every request.
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, initializing, user } = useAuth();
  const location = useLocation();

  if (initializing) return <LoadingSpinner fullScreen label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
