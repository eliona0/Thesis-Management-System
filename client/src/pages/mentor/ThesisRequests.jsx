import { useCallback, useEffect, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Date unavailable'
const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'

export default function MentorRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionId, setActionId] = useState(null)

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/mentor/requests')
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load mentor requests.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/mentor/requests')
      .then(({ data }) => { if (active) setRequests(Array.isArray(data.requests) ? data.requests : []) })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load mentor requests.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleDecision = async (request, decision) => {
    if (actionId !== null) return
    if (decision === 'reject' && !window.confirm(`Reject ${fullName(request.student)}’s mentor request?`)) return
    setActionId(request.id)
    setError('')
    setNotice('')
    try {
      const { data } = await api.patch(`/mentor/requests/${request.id}/${decision}`)
      const updated = data.request
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, ...updated } : item))
      setNotice(data.message || `Request ${decision === 'accept' ? 'accepted' : 'rejected'} successfully.`)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to ${decision} this request.`))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadRequests(true)
    } finally {
      setActionId(null)
    }
  }

  const pendingCount = requests.filter((request) => request.status === 'PENDING').length

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>Mentor requests</h1><p>Review and respond to students who have requested your mentorship.</p></header>
    <section className="mentor-request-section" aria-labelledby="mentor-requests-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Incoming requests</span><h2 id="mentor-requests-heading">Student requests</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{pendingCount} pending</span><button className="button button-quiet" type="button" onClick={() => loadRequests(true)} disabled={refreshing || loading}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {error && <div className="notice error" role="alert">{error}<button type="button" className="notice-dismiss" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading requests…</div>
        : requests.length === 0 ? <div className="mentor-request-state">You don’t have any mentor requests yet.</div>
          : <div className="request-list">{requests.map((request) => {
            const student = request.student || {}
            const pending = request.status === 'PENDING'
            return <article className="mentor-request-row" key={request.id}>
              <div className="request-person"><div className="mentor-avatar request-avatar" aria-hidden="true">{fullName(student).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><h3>{fullName(student)}</h3><p>{student.email || 'Email unavailable'}</p></div></div>
              <div className="request-row-meta"><span>Requested {formatDate(request.requestDate)}</span>{student.studentProfile?.studentNumber && <span>Student no. {student.studentProfile.studentNumber}</span>}{student.studyProgram?.name && <span>{student.studyProgram.name}</span>}{request.message && <p className="request-message">“{request.message}”</p>}</div>
              <span className={`request-status status-${String(request.status || 'unknown').toLowerCase()}`}>{String(request.status || 'UNKNOWN').replaceAll('_', ' ')}</span>
              {pending && <div className="mentor-request-actions"><button className="button button-primary" type="button" disabled={actionId !== null} onClick={() => handleDecision(request, 'accept')}>{actionId === request.id ? <><span className="spinner" aria-hidden="true" /> Please wait…</> : 'Accept'}</button><button className="button button-quiet button-reject" type="button" disabled={actionId !== null} onClick={() => handleDecision(request, 'reject')}>Reject</button></div>}
            </article>
          })}</div>}
    </section>
  </div>
}
