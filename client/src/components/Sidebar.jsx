import { NavLink } from 'react-router-dom'
import useAuth from '../context/useAuth'

const navigation = {
  STUDENT: [
    ['dashboard', 'Dashboard'], ['mentor-requests', 'Mentor Requests'], ['thesis', 'Thesis'],
    ['versions', 'Versions'], ['profile', 'Profile'],
  ],
  MENTOR: [
    ['dashboard', 'Dashboard'], ['requests', 'Mentor Requests'], ['students', 'Students'], ['feedback', 'Feedback'],
  ],
  ADMIN: [
    ['dashboard', 'Dashboard'], ['committees', 'Committees'], ['users', 'Users'], ['programs', 'Programs'],
  ],
  COMMITTEE_MEMBER: [['dashboard', 'Dashboard'], ['evaluations', 'Evaluations']],
}

export default function Sidebar() {
  const { user } = useAuth()
  const base = ({ STUDENT: '/student', MENTOR: '/mentor', ADMIN: '/admin', COMMITTEE_MEMBER: '/committee' })[user?.role] || ''
  const items = navigation[user?.role] || []

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-heading">Workspace</div>
      <nav className="sidebar-nav">
        {items.map(([path, label]) => (
          <NavLink key={path} to={`${base}/${path}`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="nav-indicator" aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-role">
        <span className="role-dot" />{user?.role?.replaceAll('_', ' ') || 'Member'}
      </div>
    </aside>
  )
}
