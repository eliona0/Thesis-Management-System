import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../context/useAuth'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import { roleHomePath } from './rolePaths'
import StudentDashboard from '../pages/student/StudentDashboard'
import Profile from '../pages/student/Profile'
import MentorRequests from '../pages/student/MentorRequests'
import Thesis from '../pages/student/Thesis'
import MentorDashboard from '../pages/mentor/MentorDashboard'
import MentorRequestsPage from '../pages/mentor/ThesisRequests'

function LoadingScreen() {
  return <div className="screen-state" role="status"><span className="spinner" />Checking your session…</div>
}

function RequireAuth() {
  const { authenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  return authenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}

function RequireGuest() {
  const { authenticated, loading, user } = useAuth()
  if (loading) return <LoadingScreen />
  return authenticated ? <Navigate to={roleHomePath(user?.role)} replace /> : <Outlet />
}

function RequireRole({ role }) {
  const { user } = useAuth()
  if (user?.role !== role) return <AccessDenied />
  return <Outlet />
}

function AccessDenied() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <section className="state-card" role="alert">
      <span className="eyebrow">Access restricted</span>
      <h1>This area is not available to your account.</h1>
      <p>Your account role does not have access to this page.</p>
      <button className="button" onClick={() => navigate(roleHomePath(user?.role), { replace: true })}>Go to my dashboard</button>
    </section>
  )
}

function FoundationPage({ title }) {
  return (
    <section className="page-heading">
      <span className="eyebrow">Thesis Management System</span>
      <h1>{title}</h1>
      <p>This section is ready for its feature implementation.</p>
    </section>
  )
}

function RoleLanding() {
  const { user } = useAuth()
  const names = { STUDENT: 'Student', MENTOR: 'Mentor', ADMIN: 'Admin', COMMITTEE_MEMBER: 'Committee' }
  return <FoundationPage title={`${names[user?.role] || 'Account'} dashboard`} />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireGuest />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/student" element={<RequireRole role="STUDENT" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="mentor-requests" element={<MentorRequests />} />
            <Route path="thesis" element={<Thesis />} />
            <Route path="versions" element={<FoundationPage title="Versions" />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/mentor" element={<RequireRole role="MENTOR" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<MentorDashboard />} />
            <Route path="requests" element={<MentorRequestsPage />} />
            <Route path="thesis-requests" element={<Navigate to="/mentor/requests" replace />} />
            <Route path="students" element={<FoundationPage title="Students" />} />
            <Route path="feedback" element={<FoundationPage title="Feedback" />} />
          </Route>
          <Route path="/admin" element={<RequireRole role="ADMIN" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<RoleLanding />} />
            <Route path="committees" element={<FoundationPage title="Committees" />} />
            <Route path="users" element={<FoundationPage title="Users" />} />
            <Route path="programs" element={<FoundationPage title="Programs" />} />
          </Route>
          <Route path="/committee" element={<RequireRole role="COMMITTEE_MEMBER" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<RoleLanding />} />
            <Route path="evaluations" element={<FoundationPage title="Evaluations" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function HomeRedirect() {
  const { authenticated, loading, user } = useAuth()
  if (loading) return <LoadingScreen />
  return <Navigate to={authenticated ? roleHomePath(user?.role) : '/login'} replace />
}
