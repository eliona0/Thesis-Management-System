import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../context/useAuth'
import api, { getApiErrorMessage } from '../../services/api'

export default function MentorDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.get('/mentor/profile'), api.get('/mentor/requests')])
      .then(([profileResult, requestsResult]) => {
        if (!active) return
        setProfile(profileResult.data.mentor || null)
        setRequests(Array.isArray(requestsResult.data.requests) ? requestsResult.data.requests : [])
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load your mentor dashboard.'))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your dashboard…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Dashboard unavailable</span><h1>We couldn’t load your information.</h1><p>{error}</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}>Try again</button></section>

  const mentor = profile || user || {}
  const name = [mentor.firstName, mentor.lastName].filter(Boolean).join(' ') || 'Mentor'
  const pending = requests.filter((request) => request.status === 'PENDING').length
  const decided = requests.length - pending

  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>Welcome, {name}</h1><p>Review student requests and keep track of your mentoring activity.</p></header>
    <section className="student-summary-grid" aria-label="Mentor summary">
      <article className="student-panel"><span className="eyebrow">Mentor profile</span><h2>{mentor.academicTitle ? `${mentor.academicTitle} ${name}` : name}</h2><dl className="student-detail-list"><div><dt>Email</dt><dd>{mentor.email || 'Not provided'}</dd></div><div><dt>Department</dt><dd>{mentor.department || mentor.studyProgram?.department || 'Not provided'}</dd></div><div><dt>Specialization</dt><dd>{mentor.specialization || 'Not provided'}</dd></div><div><dt>Availability</dt><dd>{mentor.isAvailable ? 'Available' : 'Unavailable'}</dd></div></dl></article>
      <article className="student-panel"><span className="eyebrow">Mentoring activity</span><h2>Request overview</h2><dl className="student-detail-list"><div><dt>Pending requests</dt><dd>{pending}</dd></div><div><dt>Other requests</dt><dd>{decided}</dd></div><div><dt>Total requests</dt><dd>{requests.length}</dd></div></dl><Link className="button button-primary" to="/mentor/requests">Review requests</Link></article>
    </section>
    <section className="student-panel student-workflow"><div><span className="eyebrow">Next step</span><h2>Manage mentor requests</h2><p>Accept or reject pending requests from your students.</p></div><div className="workflow-pill">{pending} pending</div></section>
  </div>
}
