import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const statusLabels = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  UNDER_EVALUATION: 'Under Evaluation',
  COMPLETED: 'Completed',
}

const valueOrFallback = (value) => value || 'Not provided'
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided'
const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const statusLabel = (status) => statusLabels[status] || (status ? status.replaceAll('_', ' ') : 'Status unavailable')

export default function Theses() {
  const [theses, setTheses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionId, setActionId] = useState(null)
  const [rejectingThesis, setRejectingThesis] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const loadTheses = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/mentor/theses')
      setTheses(Array.isArray(data.theses) ? data.theses : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your theses.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => loadTheses(false), 0)
    return () => window.clearTimeout(request)
  }, [loadTheses])

  const approveThesis = async (thesis) => {
    if (actionId !== null) return
    setActionId(thesis.id)
    setError('')
    setNotice('')
    try {
      const { data } = await api.patch(`/thesis/${thesis.id}/approve`)
      setNotice(data.message || 'Thesis approved successfully.')
      await loadTheses(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to approve this thesis.'))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadTheses(false)
    } finally {
      setActionId(null)
    }
  }

  const openRejectDialog = (thesis) => {
    setRejectingThesis(thesis)
    setRejectionReason('')
    setError('')
  }

  const rejectThesis = async (event) => {
    event.preventDefault()
    if (!rejectingThesis || actionId !== null) return
    const thesis = rejectingThesis
    setActionId(thesis.id)
    setError('')
    setNotice('')
    try {
      const { data } = await api.patch(`/thesis/${thesis.id}/reject`, { rejectionReason })
      setRejectingThesis(null)
      setRejectionReason('')
      setNotice(data.message || 'Thesis rejected. The student can revise and resubmit the thesis details.')
      await loadTheses(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to reject this thesis.'))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadTheses(false)
    } finally {
      setActionId(null)
    }
  }

  return <div className="mentor-theses-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>My theses</h1><p>Review assigned thesis proposals and track their current status.</p></header>
    <section className="mentor-request-section" aria-labelledby="mentor-theses-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Assigned work</span><h2 id="mentor-theses-heading">Thesis review</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{theses.length} {theses.length === 1 ? 'thesis' : 'theses'}</span><button className="button button-quiet" type="button" onClick={() => loadTheses()} disabled={loading || actionId !== null}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {error && <div className="notice error" role="alert">{error}<button type="button" className="notice-dismiss" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading your theses…</div>
        : error && theses.length === 0 ? <div className="mentor-request-state mentor-request-error" role="alert"><p>Your theses could not be loaded.</p><button className="button button-quiet" type="button" onClick={() => loadTheses()} disabled={loading}>Try again</button></div>
          : theses.length === 0 ? <div className="mentor-request-state">No theses assigned yet.</div>
            : <div className="mentor-thesis-list">{theses.map((thesis) => {
              const student = thesis.student || {}
              const pending = thesis.status === 'PENDING'
              const busy = actionId === thesis.id
              return <article className="student-panel mentor-thesis-card" key={thesis.id}>
                <div className="mentor-thesis-card-heading"><div><span className="eyebrow">{fullName(student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2></div><span className={`request-status status-${String(thesis.status || 'unknown').toLowerCase()}`}>{statusLabel(thesis.status)}</span></div>
                <p className="mentor-thesis-description">{valueOrFallback(thesis.description)}</p>
                <dl className="student-detail-list mentor-thesis-details">
                  <div><dt>Student email</dt><dd>{valueOrFallback(student.email)}</dd></div>
                  <div><dt>Student number</dt><dd>{valueOrFallback(student.studentProfile?.studentNumber)}</dd></div>
                  <div><dt>Study program</dt><dd>{valueOrFallback(student.studyProgram?.name)}</dd></div>
                  <div><dt>Research field</dt><dd>{valueOrFallback(thesis.researchField)}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(thesis.createdAt)}</dd></div>
                  <div><dt>Last updated</dt><dd>{formatDate(thesis.updatedAt)}</dd></div>
                  {thesis.startedAt && <div><dt>Started</dt><dd>{formatDate(thesis.startedAt)}</dd></div>}
                </dl>
                {thesis.status === 'IN_PROGRESS' && <Link className="button button-primary" to={`/mentor/theses/${thesis.id}/versions`}>Review thesis versions</Link>}
                {pending ? <div className="mentor-thesis-actions"><button className="button button-primary" type="button" disabled={actionId !== null} onClick={() => approveThesis(thesis)}>{busy ? <><span className="spinner" aria-hidden="true" /> Please wait…</> : 'Approve'}</button><button className="button button-quiet button-reject" type="button" disabled={actionId !== null} onClick={() => openRejectDialog(thesis)}>Reject / Request Changes</button></div>
                  : thesis.status === 'IN_PROGRESS' ? <p className="mentor-thesis-status-note">Approved. The student can now continue thesis work.</p>
                    : thesis.status === 'REJECTED' ? <p className="mentor-thesis-status-note">This thesis was rejected. No rejection reason is stored.</p> : null}
              </article>
            })}</div>}
    </section>
    {rejectingThesis && <div className="mentor-dialog-backdrop" role="presentation"><section className="mentor-reject-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-thesis-title"><span className="eyebrow">Request changes</span><h2 id="reject-thesis-title">Reject this thesis?</h2><p>{fullName(rejectingThesis.student)} will see the thesis marked as rejected and can revise its details.</p><form className="mentor-reject-form" onSubmit={rejectThesis}><label htmlFor="rejection-reason">Reason <span className="optional-label">(optional)</span></label><textarea id="rejection-reason" rows="4" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Add context for this request" /><p className="mentor-rejection-disclaimer">The reason is sent with this request but is not saved by the system.</p>{error && <p className="thesis-form-error" role="alert">{error}</p>}<div className="mentor-form-actions"><button className="button button-quiet" type="button" disabled={actionId !== null} onClick={() => setRejectingThesis(null)}>Cancel</button><button className="button button-quiet button-reject" type="submit" disabled={actionId !== null}>{actionId === rejectingThesis.id ? <><span className="spinner" aria-hidden="true" /> Please wait…</> : 'Reject thesis'}</button></div></form></section></div>}
  </div>
}
