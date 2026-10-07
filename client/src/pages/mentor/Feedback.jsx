import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Date unavailable'

export default function Feedback() {
  const [feedback, setFeedback] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/mentor/feedbacks')
      setFeedback(Array.isArray(data.feedback) ? data.feedback : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your feedback.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(loadFeedback, 0)
    return () => window.clearTimeout(request)
  }, [loadFeedback])

  const filteredFeedback = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return feedback.filter((item) => {
      const student = item.version?.thesis?.student || {}
      const searchable = [fullName(student), student.email, student.studentProfile?.studentNumber, item.version?.thesis?.title, item.comment]
        .filter(Boolean).join(' ').toLocaleLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
  }, [feedback, query])

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>Feedbacks</h1><p>Review the feedback you have given on your students’ submitted thesis versions.</p></header>
    <section className="mentor-request-section" aria-labelledby="mentor-feedback-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Feedback history</span><h2 id="mentor-feedback-heading">Your feedback</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{feedback.length} {feedback.length === 1 ? 'entry' : 'entries'}</span><button className="button button-quiet" type="button" onClick={loadFeedback} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {!loading && !error && feedback.length > 0 && <label className="mentor-list-search"><span>Find feedback</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Student, thesis, or feedback text" /></label>}
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading your feedback…</div>
        : error && feedback.length === 0 ? <div className="mentor-request-state mentor-request-error"><p>Your feedback could not be loaded.</p><button className="button button-quiet" type="button" onClick={loadFeedback} disabled={loading}>Try again</button></div>
          : feedback.length === 0 ? <div className="mentor-request-state">You have not given feedback on a thesis version yet.</div>
            : filteredFeedback.length === 0 ? <div className="mentor-request-state">No feedback matches “{query}”.</div>
              : <div className="version-list">{filteredFeedback.map((item) => {
                const version = item.version || {}
                const thesis = version.thesis || {}
                const student = thesis.student || {}
                return <article className="student-panel version-card mentor-feedback-card" key={item.id}>
                  <div className="version-card-heading"><div><span className="eyebrow">{fullName(student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2></div><span className="request-status status-reviewed">Version {version.versionNumber ?? '—'}</span></div>
                  <dl className="student-detail-list">
                    <div><dt>Student email</dt><dd>{student.email || 'Not provided'}</dd></div>
                    <div><dt>Student number</dt><dd>{student.studentProfile?.studentNumber || 'Not provided'}</dd></div>
                    <div><dt>Study program</dt><dd>{student.studyProgram?.name || 'Not provided'}</dd></div>
                    <div><dt>Feedback date</dt><dd>{formatDate(item.createdAt)}</dd></div>
                    <div><dt>Version submitted</dt><dd>{formatDate(version.submittedAt)}</dd></div>
                  </dl>
                  <section className="version-feedback" aria-label="Feedback comment"><span className="eyebrow">Feedback provided</span><p>{item.comment}</p></section>
                  {thesis.id && <Link className="button button-quiet" to={`/mentor/theses/${thesis.id}/versions`}>Open thesis versions</Link>}
                </article>
              })}</div>}
    </section>
  </div>
}
