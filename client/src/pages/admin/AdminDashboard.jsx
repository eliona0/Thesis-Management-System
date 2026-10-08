import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getApiErrorMessage } from '../../services/api'

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/dashboard')
      setSummary(data.dashboard || null)
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to load the admin dashboard.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const request = window.setTimeout(load, 0); return () => window.clearTimeout(request) }, [load])

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading admin dashboard…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Dashboard unavailable</span><h1>We couldn’t load admin information.</h1><p>{error}</p><button className="button button-primary" type="button" onClick={load}>Try again</button></section>

  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Admin workspace</span><h1>Dashboard</h1><p>A current overview of accounts, study programs, and thesis Committees.</p></header>
    <section className="student-summary-grid" aria-label="Admin summary">
      <article className="student-panel"><span className="eyebrow">Accounts</span><h2>{summary.totalUsers} users</h2><dl className="student-detail-list"><div><dt>Students</dt><dd>{summary.students}</dd></div><div><dt>Mentors</dt><dd>{summary.mentors}</dd></div><div><dt>Committee Members</dt><dd>{summary.committeeMembers}</dd></div><div><dt>Administrators</dt><dd>{summary.admins}</dd></div></dl><Link className="student-text-link" to="/admin/users">Manage users <span aria-hidden="true">→</span></Link></article>
      <article className="student-panel"><span className="eyebrow">Study programs</span><h2>{summary.studyPrograms} programs</h2><p>Programs currently available and archived in the directory.</p><Link className="student-text-link" to="/admin/programs">Manage programs <span aria-hidden="true">→</span></Link></article>
      <article className="student-panel"><span className="eyebrow">Thesis workflow</span><h2>Thesis overview</h2><dl className="student-detail-list"><div><dt>Active / in progress</dt><dd>{summary.activeTheses}</dd></div><div><dt>Completed theses</dt><dd>{summary.completedTheses}</dd></div><div><dt>Upcoming defenses</dt><dd>{summary.upcomingDefenseCount}</dd></div></dl><Link className="student-text-link" to="/admin/committees">Manage Committees <span aria-hidden="true">→</span></Link></article>
    </section>
    <section className="mentor-request-section" aria-labelledby="upcoming-defenses"><div className="mentor-request-section-heading"><div><span className="eyebrow">Committee schedule</span><h2 id="upcoming-defenses">Upcoming defenses</h2></div><Link className="button button-quiet" to="/admin/committees">Manage Committees</Link></div>
      {summary.upcomingDefenses.length === 0 ? <div className="mentor-request-state">There are no upcoming defenses scheduled.</div> : <div className="version-list">{summary.upcomingDefenses.map((item) => <article className="student-panel" key={item.id}><div className="version-card-heading"><div><span className="eyebrow">{[item.thesis?.student?.firstName, item.thesis?.student?.lastName].filter(Boolean).join(' ') || 'Student'}</span><h2>{item.thesis?.title || 'Untitled thesis'}</h2></div><span className="request-status status-submitted">{item.status?.replaceAll('_', ' ')}</span></div><dl className="student-detail-list"><div><dt>Defense date</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.defenseDate))}</dd></div></dl></article>)}</div>}
    </section>
  </div>
}
