import { useCallback, useEffect, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled'

export default function Evaluations() {
  const [assignments, setAssignments] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAssignments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/committee/my')
      setAssignments(Array.isArray(data.assignments) ? data.assignments : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load your assigned Committees.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => loadAssignments(), 0)
    return () => window.clearTimeout(request)
  }, [loadAssignments])

  const updateDraft = (thesisId, field, value) => setDrafts((current) => ({
    ...current, [thesisId]: { ...current[thesisId], [field]: value },
  }))

  const submitEvaluation = async (event, assignment) => {
    event.preventDefault()
    if (savingId !== null) return
    const draft = drafts[assignment.thesis.id] || {}
    setSavingId(assignment.thesis.id)
    setError('')
    setNotice('')
    try {
      await api.post(`/committee/thesis/${assignment.thesis.id}/evaluations`, {
        grade: Number(draft.grade), comments: draft.comments || '',
      })
      setDrafts((current) => ({ ...current, [assignment.thesis.id]: { grade: '', comments: '' } }))
      setNotice('Your evaluation has been submitted and cannot be changed.')
      await loadAssignments(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to submit your evaluation.'))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadAssignments(false)
    } finally {
      setSavingId(null)
    }
  }

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Committee workspace</span><h1>Evaluations</h1><p>Review theses assigned to you and submit one grade and comment for each scheduled defense.</p></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {notice && <div className="notice success" role="status">{notice}</div>}
    <section className="mentor-request-section" aria-labelledby="committee-evaluations-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Your assignments</span><h2 id="committee-evaluations-heading">Assigned Committees</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{assignments.length} assigned</span><button className="button button-quiet" type="button" onClick={() => loadAssignments()} disabled={loading || savingId !== null}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading your Committees…</div>
        : assignments.length === 0 ? <div className="mentor-request-state">You are not assigned to a Committee yet.</div>
          : <div className="version-list">{assignments.map((assignment) => {
            const thesis = assignment.thesis || {}
            const committee = assignment.committee || {}
            const evaluation = assignment.evaluation
            const draft = drafts[thesis.id] || {}
            const defenseReached = committee.defenseDate && new Date(committee.defenseDate) <= new Date()
            const canEvaluate = committee.status === 'SCHEDULED' && defenseReached && !evaluation
            return <article className="student-panel" key={committee.id}>
              <div className="version-card-heading"><div><span className="eyebrow">{fullName(thesis.student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2></div><span className="request-status status-submitted">{committee.status?.replaceAll('_', ' ') || 'Status unavailable'}</span></div>
              <dl className="student-detail-list">
                <div><dt>Student email</dt><dd>{thesis.student?.email || 'Not provided'}</dd></div>
                <div><dt>Thesis status</dt><dd>{thesis.status?.replaceAll('_', ' ') || 'Status unavailable'}</dd></div>
                <div><dt>Committee role</dt><dd>{assignment.member?.role === 'CHAIR' ? 'Chair' : 'Member'}</dd></div>
                <div><dt>Defense date</dt><dd>{formatDate(committee.defenseDate)}</dd></div>
                <div><dt>Research field</dt><dd>{thesis.researchField || 'Not provided'}</dd></div>
              </dl>
              <section className="version-feedback"><span className="eyebrow">Thesis information</span><p>{thesis.description || 'No thesis description provided.'}</p></section>
              {evaluation ? <section className="version-feedback" aria-label="Your submitted evaluation"><span className="eyebrow">Your submitted evaluation</span><p><strong>Grade: {evaluation.grade}</strong></p><p>{evaluation.comments || 'No comments provided.'}</p><small>{formatDate(evaluation.evaluationDate)}</small></section>
                : committee.status === 'SCHEDULED' && !defenseReached ? <p className="mentor-thesis-status-note">Evaluation will be available on the defense date.</p>
                  : canEvaluate ? <form className="thesis-edit-form" onSubmit={(event) => submitEvaluation(event, assignment)}>
                  <label htmlFor={`grade-${thesis.id}`}>Grade (6–10)</label>
                  <input id={`grade-${thesis.id}`} type="number" min="6" max="10" step="0.01" required value={draft.grade || ''} onChange={(event) => updateDraft(thesis.id, 'grade', event.target.value)} />
                  <label htmlFor={`comments-${thesis.id}`}>Comments (optional)</label>
                  <textarea id={`comments-${thesis.id}`} rows="4" maxLength="10000" value={draft.comments || ''} onChange={(event) => updateDraft(thesis.id, 'comments', event.target.value)} placeholder="Add your evaluation comments" />
                  <div className="thesis-form-actions"><button className="button button-primary" type="submit" disabled={savingId !== null}>{savingId === thesis.id ? 'Submitting…' : 'Submit evaluation'}</button></div>
                </form> : <p className="mentor-thesis-status-note">Evaluation is unavailable for this Committee.</p>}
            </article>
          })}</div>}
    </section>
  </div>
}
