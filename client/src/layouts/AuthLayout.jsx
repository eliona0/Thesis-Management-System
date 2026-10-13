import { Link, Outlet } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

export default function AuthLayout() {
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link className="brand-lockup" to="/login" aria-label="Thesis Management System home">
          <BrandMark />
          <span>UBT - Thesis Management System</span>
        </Link>
        <div className="auth-message">
          <span className="eyebrow">University workspace</span>
          <h1>Make every step of your thesis journey clear.</h1>
          <p>A shared space for students, mentors, administrators, and committee members.</p>
        </div>
        <div className="auth-footnote">A focused workspace for academic progress.</div>
      </section>
      <section className="auth-panel"><Outlet /></section>
    </main>
  )
}
