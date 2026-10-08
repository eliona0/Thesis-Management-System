import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../context/useAuth'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Committee Member'
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled'

export default function CommitteeDashboard() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/committee/dashboard')
      setAssignments(Array.isArray(data.assignments) ? data.assignments : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your Committee dashboard.'))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { const request = window.setTimeout(load, 0); return () => window.clearTimeout(request) }, [load])

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your dashboard…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Dashboard unavailable</span><h1>We couldn’t load your information.</h1><p>{error}</p><button className="button button-primary" type="button" onClick={load}>Try again</button></section>

  const pending = assignments.filter(({ committee, evaluationSubmitted }) => committee?.status === 'SCHEDULED' && !evaluationSubmitted).length
  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Committee workspace</span><h1>Welcome, {fullName(user)}</h1><p>See your assigned defenses, evaluation progress, and next steps.</p></header>
    <section className="student-summary-grid" aria-label="Committee summary">
      <article className="student-panel"><span className="eyebrow">Your workload</span><h2>Assignment overview</h2><dl className="student-detail-list"><div><dt>Assigned Committees</dt><dd>{assignments.length}</dd></div><div><dt>Evaluations awaiting yours</dt><dd>{pending}</dd></div><div><dt>Completed theses</dt><dd>{assignments.filter(({ committee }) => committee?.status === 'COMPLETED').length}</dd></div></dl><Link className="button button-primary" to="/committee/evaluations">Open evaluations</Link></article>
      <article className="student-panel"><span className="eyebrow">Getting started</span><h2>Review your assignments</h2><p>Evaluation details remain private to each Committee Member. As Chair, you can review the submitted grades when all three evaluations are complete.</p><Link className="student-text-link" to="/committee/evaluations">Go to Evaluations <span aria-hidden="true">→</span></Link></article>
    </section>
    <section className="mentor-request-section" aria-labelledby="upcoming-defenses">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Your schedule</span><h2 id="upcoming-defenses">Assigned defenses</h2></div><span className="mentor-count">{assignments.length} assigned</span></div>
      {assignments.length === 0 ? <div className="mentor-request-state">You are not assigned to a Committee yet.</div> : <div className="version-list">{assignments.map(({ committee = {}, thesis = {}, role, members = [], evaluationCount = 0, evaluationSubmitted = false }) => {
        const defenseReached = committee.defenseDate && new Date(committee.defenseDate) <= new Date()
        const defenseStatus = committee.status === 'COMPLETED' ? 'Completed' : committee.status !== 'SCHEDULED' ? 'Not scheduled' : defenseReached ? 'Available for evaluation' : 'Upcoming'
        return <article className="student-panel" key={committee.id}><div className="version-card-heading"><div><span className="eyebrow">{fullName(thesis.student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2></div><span className="request-status status-submitted">{committee.status?.replaceAll('_', ' ') || 'Status unavailable'}</span></div><dl className="student-detail-list"><div><dt>Your role</dt><dd>{role === 'CHAIR' ? 'Chair' : 'Member'}</dd></div><div><dt>Defense date</dt><dd>{formatDate(committee.defenseDate)}</dd></div><div><dt>Defense status</dt><dd>{defenseStatus}</dd></div><div><dt>Your evaluation</dt><dd>{evaluationSubmitted ? 'Completed' : committee.status === 'SCHEDULED' ? 'Pending' : 'Not open'}</dd></div><div><dt>Evaluation progress</dt><dd>{evaluationCount}/3 submitted</dd></div></dl><h3>Committee members</h3><ul>{members.map((member, index) => <li key={`${member.role}-${index}`}>{member.name || 'Committee Member'} — {member.role === 'CHAIR' ? 'Chair' : 'Member'}</li>)}</ul></article>
      })}</div>}
    </section>
  </div>
}
