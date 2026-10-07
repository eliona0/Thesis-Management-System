import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../context/useAuth'
import api, { getApiErrorMessage } from '../../services/api'

const display = (value) => value || 'Not provided'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [thesis, setThesis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await api.get('/student/profile')
        if (!active) return
        setProfile(data.student || null)
        try {
          const thesisResult = await api.get('/thesis/my-thesis')
          if (active) setThesis(thesisResult.data.thesis || null)
        } catch (requestError) {
          if (requestError.response?.status !== 404) throw requestError
          if (active) setThesis(null)
        }
      } catch (requestError) {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load your dashboard.'))
      } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [])

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your dashboard…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Dashboard unavailable</span><h1>We couldn’t load your information.</h1><p>{error}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></section>

  const student = profile || user || {}
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Student'
  const mentorName = thesis?.mentor ? [thesis.mentor.firstName, thesis.mentor.lastName].filter(Boolean).join(' ') : ''
  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Student workspace</span><h1>Welcome, {fullName}</h1><p>Your student profile and thesis progress at a glance.</p></header>
    <section className="student-summary-grid" aria-label="Student summary">
      <article className="student-panel"><div className="student-panel-heading"><div><span className="eyebrow">Your details</span><h2>Student profile</h2></div><Link className="button button-quiet" to="/student/profile">View profile</Link></div>
        <dl className="student-detail-list"><div><dt>Name</dt><dd>{fullName}</dd></div><div><dt>Email</dt><dd>{display(student.email)}</dd></div><div><dt>Study program</dt><dd>{display(student.studyProgram)}</dd></div><div><dt>Student number</dt><dd>{display(student.studentNumber)}</dd></div></dl>
      </article>
      <article className="student-panel"><span className="eyebrow">Thesis progress</span><h2>{thesis?.title || (thesis ? 'Thesis details' : 'No thesis record')}</h2>
        {thesis ? <><p className="student-status"><span className="status-dot" />{(thesis.status || 'Status unavailable').replaceAll('_', ' ')}</p><dl className="student-detail-list"><div><dt>Mentor</dt><dd>{mentorName || 'Not assigned'}</dd></div>{thesis.mentor?.email && <div><dt>Mentor email</dt><dd>{thesis.mentor.email}</dd></div>}</dl></> : <p>No thesis is currently associated with your account.</p>}
        {thesis && <Link className="student-text-link" to="/student/thesis">Open thesis section <span aria-hidden="true">→</span></Link>}
      </article>
    </section>
    <section className="student-panel student-workflow" aria-labelledby="workflow-title"><div><span className="eyebrow">Workflow</span><h2 id="workflow-title">Current status</h2><p>{thesis ? `Your thesis is ${String(thesis.status || 'in an unavailable status').replaceAll('_', ' ').toLowerCase()}.` : 'Your thesis workflow will appear here when a thesis record is available.'}</p></div><div className="workflow-pill">{thesis?.status ? thesis.status.replaceAll('_', ' ') : 'Awaiting thesis record'}</div></section>
  </div>
}
