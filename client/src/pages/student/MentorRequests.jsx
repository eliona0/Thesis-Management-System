import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import api, { getApiErrorMessage } from '../../services/api'

const statusLabels = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const mentorForRequest = (request) => request.mentor?.user || request.mentor || {}
const mentorName = (mentor) => [mentor.firstName, mentor.lastName].filter(Boolean).join(' ') || 'Mentor'
const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
const readableStatus = (status) => statusLabels[status] || String(status || 'Unknown').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())

export default function MentorRequests() {
  const [mentors, setMentors] = useState([])
  const [requests, setRequests] = useState([])
  const [mentorsLoading, setMentorsLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [mentorsError, setMentorsError] = useState('')
  const [requestsError, setRequestsError] = useState('')
  const [selectedMentor, setSelectedMentor] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadMentors = async () => {
    setMentorsLoading(true)
    setMentorsError('')
    try {
      const { data } = await api.get('/student/mentors')
      setMentors(Array.isArray(data.mentors) ? data.mentors : [])
    } catch (error) {
      setMentorsError(getApiErrorMessage(error, 'Unable to load available mentors.'))
    } finally { setMentorsLoading(false) }
  }

  const loadRequests = async () => {
    setRequestsLoading(true)
    setRequestsError('')
    try {
      const { data } = await api.get('/mentor-requests/my')
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error) {
      setRequestsError(getApiErrorMessage(error, 'Unable to load your mentor requests.'))
    } finally { setRequestsLoading(false) }
  }

  useEffect(() => {
    let active = true
    api.get('/student/mentors')
      .then(({ data }) => { if (active) setMentors(Array.isArray(data.mentors) ? data.mentors : []) })
      .catch((error) => { if (active) setMentorsError(getApiErrorMessage(error, 'Unable to load available mentors.')) })
      .finally(() => { if (active) setMentorsLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/mentor-requests/my')
      .then(({ data }) => { if (active) setRequests(Array.isArray(data.requests) ? data.requests : []) })
      .catch((error) => { if (active) setRequestsError(getApiErrorMessage(error, 'Unable to load your mentor requests.')) })
      .finally(() => { if (active) setRequestsLoading(false) })
    return () => { active = false }
  }, [])

  const pendingMentorIds = new Set(requests.filter((request) => request.status === 'PENDING').map((request) => request.mentorId ?? request.mentor?.id))

  const beginRequest = (mentor) => {
    setSelectedMentor(mentor)
    setMessage('')
    setSubmitError('')
    setSuccessMessage('')
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    if (!selectedMentor || submitting) return
    setSubmitting(true)
    setSubmitError('')
    setSuccessMessage('')
    try {
      const { data } = await api.post('/mentor-requests', {
        mentorId: selectedMentor.id,
        ...(message.trim() ? { message: message.trim() } : {}),
      })
      if (data.request) setRequests((current) => [data.request, ...current])
      setSuccessMessage(data.message || 'Your mentor request was sent successfully.')
      setSelectedMentor(null)
      setMessage('')
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Unable to send your mentor request. Please try again.'))
    } finally { setSubmitting(false) }
  }

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Student workspace</span><h1>Mentor requests</h1><p>Explore available mentors and follow the status of your requests.</p></header>

    {successMessage && <div className="notice success" role="status">{successMessage}</div>}
    {submitError && <div className="notice error" role="alert">{submitError}</div>}

    <section className="mentor-request-section" aria-labelledby="available-mentors-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Find support</span><h2 id="available-mentors-heading">Available mentors</h2></div>{!mentorsLoading && !mentorsError && <span className="mentor-count">{mentors.length} available</span>}</div>
      {mentorsLoading && <div className="mentor-request-state" role="status"><span className="spinner" />Loading available mentors…</div>}
      {mentorsError && <div className="mentor-request-state mentor-request-error" role="alert"><p>{mentorsError}</p><Button className="button-quiet" onClick={loadMentors}>Try again</Button></div>}
      {!mentorsLoading && !mentorsError && mentors.length === 0 && <div className="mentor-request-state">No mentors are available at the moment.</div>}
      {!mentorsLoading && !mentorsError && mentors.length > 0 && <div className="mentor-card-grid">{mentors.map((mentor) => {
        const hasPendingRequest = pendingMentorIds.has(mentor.id) || requests.some((request) => request.status === 'PENDING' && mentor.email && mentorForRequest(request).email === mentor.email)
        return <article className="mentor-card" key={mentor.id}>
          <div className="mentor-card-top"><div className="mentor-avatar" aria-hidden="true">{mentorName(mentor).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><span className="availability-badge">Available</span></div>
          <h3>{mentorName(mentor)}</h3>
          {mentor.academicTitle && <p className="mentor-academic-title">{mentor.academicTitle}</p>}
          {mentor.email && <p className="mentor-contact">{mentor.email}</p>}
          {mentor.department && <p className="mentor-meta"><strong>Department</strong>{mentor.department}</p>}
          {mentor.specialization && <p className="mentor-meta"><strong>Specialization</strong>{mentor.specialization}</p>}
          {hasPendingRequest ? <span className="mentor-pending-note">Request pending</span> : <Button className="button-primary mentor-request-button" onClick={() => beginRequest(mentor)}>Request mentor</Button>}
        </article>
      })}</div>}
    </section>

    {selectedMentor && <section className="mentor-confirm-panel" aria-labelledby="confirm-request-heading"><div><span className="eyebrow">Confirm request</span><h2 id="confirm-request-heading">Request {mentorName(selectedMentor)}</h2><p>This will send a mentor request to this person. You can include a short message.</p></div>
      <form onSubmit={submitRequest} className="mentor-request-form"><label className="field"><span>Message <span className="optional-label">(optional)</span></span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="3" maxLength="2000" placeholder="Add a brief introduction or context" /></label>
        <div className="mentor-form-actions"><Button type="button" className="button-quiet" disabled={submitting} onClick={() => { setSelectedMentor(null); setSubmitError('') }}>Keep browsing</Button><Button type="submit" className="button-primary" loading={submitting}>Send request</Button></div>
      </form>
    </section>}

    <section className="mentor-request-section" aria-labelledby="my-requests-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Request history</span><h2 id="my-requests-heading">My mentor requests</h2></div></div>
      {requestsLoading && <div className="mentor-request-state" role="status"><span className="spinner" />Loading your requests…</div>}
      {requestsError && <div className="mentor-request-state mentor-request-error" role="alert"><p>{requestsError}</p><Button className="button-quiet" onClick={loadRequests}>Try again</Button></div>}
      {!requestsLoading && !requestsError && requests.length === 0 && <div className="mentor-request-state">You have not submitted any mentor requests yet.</div>}
      {!requestsLoading && !requestsError && requests.length > 0 && <div className="request-list">{requests.map((request) => {
        const mentor = mentorForRequest(request)
        const requestDate = formatDate(request.requestDate)
        const responseDate = formatDate(request.responseDate)
        return <article className="request-row" key={request.id}><div className="request-person"><div className="mentor-avatar request-avatar" aria-hidden="true">{mentorName(mentor).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><h3>{mentorName(mentor)}</h3>{mentor.email && <p>{mentor.email}</p>}</div></div><div className="request-row-meta">{requestDate && <span>Sent {requestDate}</span>}{responseDate && <span>Updated {responseDate}</span>}{request.message && <span className="request-message">{request.message}</span>}</div><span className={`request-status status-${String(request.status || 'unknown').toLowerCase()}`}>{readableStatus(request.status)}</span></article>
      })}</div>}
    </section>
  </div>
}