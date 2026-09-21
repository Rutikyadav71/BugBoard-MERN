import { Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import GuestRoute from './components/GuestRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import CreateProjectPage from './pages/CreateProjectPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import CreateIssuePage from './pages/CreateIssuePage.jsx';
import EditIssuePage from './pages/EditIssuePage.jsx';
import IssueDetailPage from './pages/IssueDetailPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import UnauthorizedPage from './pages/UnauthorizedPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>
        </Route>

        {/* Role-gated routes: UX guard only; the API enforces the same rules. */}
        <Route element={<ProtectedRoute roles={['Admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/projects/new" element={<CreateProjectPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/issues/new" element={<CreateIssuePage />} />
            <Route path="/issues/:id/edit" element={<EditIssuePage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
