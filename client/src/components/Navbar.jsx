import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../context/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <Link className="brand-lockup" to="/" aria-label="Thesis Management System dashboard">
        <span className="brand-mark">T</span>
        <span>Thesis Management System</span>
      </Link>
      <div className="topbar-account">
        <div className="account-copy">
          <strong>{name || user?.email || 'Account'}</strong>
          {name && user?.email && <span>{user.email}</span>}
        </div>
        <button className="button button-quiet" type="button" onClick={handleLogout}>Log out</button>
      </div>
    </header>
  )
}
