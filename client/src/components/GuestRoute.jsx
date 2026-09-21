import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

// Login/Register are only for signed-out users.
export default function GuestRoute() {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return <LoadingSpinner fullScreen />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
