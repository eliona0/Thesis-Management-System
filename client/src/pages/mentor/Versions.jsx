import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const formatStatus = (status) => status ? status.replaceAll('_', ' ') : 'Status unavailable'

export default function MentorVersions() {
  const { thesisId } = useParams()
  const [thesis, setThesis] = useState(null)
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [comments, setComments] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [finalApprovalStatus, setFinalApprovalStatus] = useState({})
  const [finalEvaluations, setFinalEvaluations] = useState({})
  const [finalGrades, setFinalGrades] = useState({})
  const [rejectionFeedback, setRejectionFeedback] = useState({})
  const actionLock = useRef(false)

  const loadVersions = useCallback(async () => {
    setError('')
    try {
      const [thesesResponse, versionsResponse] = await Promise.all([
        api.get('/mentor/theses'),
        api.get(`/thesis/${thesisId}/versions`),
      ])
      const assignedThesis = (thesesResponse.data.theses || []).find((item) => String(item.id) === thesisId)
      if (!assignedThesis) {
        setThesis(null)
        setVersions([])
        setError('This thesis is not available in your assigned thesis list.')
        return
      }
      setThesis(assignedThesis)
      const loadedVersions = Array.isArray(versionsResponse.data.versions) ? versionsResponse.data.versions : []
      setVersions(loadedVersions)
      const statusPairs = await Promise.all(loadedVersions.filter((version) => version.status === 'SUBMITTED' && version.submittedAt).map(async (version) => {
        try {
          const { data } = await api.get(`/thesis/versions/${version.id}/final-approval-status`)
          return [version.id, { ...data, loadingError: '' }]
        } catch (requestError) {
          return [version.id, { loadingError: getApiErrorMessage(requestError, 'Final approval status is unavailable.') }]
        }
      }))
      setFinalApprovalStatus(Object.fromEntries(statusPairs))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load thesis versions.'))
    } finally {
      setLoading(false)
    }
  }, [thesisId])

  useEffect(() => {
    const request = window.setTimeout(loadVersions, 0)
    return () => window.clearTimeout(request)
  }, [loadVersions])

  const viewVersion = async (version) => {
    if (!version.filePath || actionLock.current) return
    const preview = window.open('', '_blank')
    if (!preview) {
      setActionError('Allow pop-ups to open the thesis PDF.')
      return
    }
    preview.opener = null
    actionLock.current = true
    setBusyId(`${version.id}:view`)
    setActionError('')
    try {
      const fileUrl = new URL(version.filePath, api.defaults.baseURL).toString()
      const { data } = await api.get(fileUrl, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(data)
      preview.location.href = blobUrl
      preview.addEventListener('pagehide', () => URL.revokeObjectURL(blobUrl), { once: true })
    } catch (requestError) {
      preview.close()
      setActionError(getApiErrorMessage(requestError, 'Unable to open this thesis PDF.'))
    } finally {
      actionLock.current = false
      setBusyId(null)
    }
  }

  const submitFeedback = async (event, version) => {
    event.preventDefault()
    if (actionLock.current || version.status !== 'SUBMITTED') return
    actionLock.current = true
    setBusyId(`${version.id}:feedback`)
    setActionError('')
    setNotice('')
    try {
      const { data } = await api.post(`/feedback/${version.id}`, { comment: comments[version.id] || '' })
      await loadVersions()
      setVersions((current) => current.map((item) => item.id === version.id ? { ...item, ...data.version, feedback: data.feedback } : item))
      setNotice('Feedback submitted and this version marked as reviewed.')
      setComments((current) => ({ ...current, [version.id]: '' }))
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Unable to submit feedback.'))
      if ([400, 403, 404, 409].includes(requestError.response?.status)) await loadVersions()
    } finally {
      actionLock.current = false
      setBusyId(null)
    }
  }

  const approveFinal = async (event, version) => {
    event.preventDefault()
    const status = finalApprovalStatus[version.id]
    const gradeText = finalGrades[version.id] || ''
    const grade = gradeText.trim() === '' ? null : Number(gradeText)
    if (actionLock.current || version.status !== 'SUBMITTED' || thesis?.status !== 'IN_PROGRESS' || status?.available !== true) return
    if (grade !== null && (!Number.isFinite(grade) || grade < 6 || grade > 10)) {
      setActionError('Final grade must be a number from 6 through 10.')
      return
    }
    if (!window.confirm('Approve this final thesis submission? The version will become APPROVED and the thesis will move to SUBMITTED.')) return
    actionLock.current = true
    setBusyId(`${version.id}:approve-final`)
    setActionError('')
    setNotice('')
    try {
      const { data } = await api.patch(`/thesis/versions/${version.id}/approve-final`, {
        mentorFinalEvaluation: finalEvaluations[version.id]?.trim() || null,
        finalGrade: grade,
      })
      if (data.thesis) setThesis((current) => ({ ...current, ...data.thesis }))
      setNotice('Final submission approved.')
      await loadVersions()
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Unable to approve this final submission.'))
      if ([400, 403, 404, 409].includes(requestError.response?.status)) await loadVersions()
    } finally {
      actionLock.current = false
      setBusyId(null)
    }
  }

  const rejectFinal = async (event, version) => {
    event.preventDefault()
    const status = finalApprovalStatus[version.id]
    const feedback = rejectionFeedback[version.id] || ''
    if (actionLock.current || version.status !== 'SUBMITTED' || thesis?.status !== 'IN_PROGRESS' || status?.available !== true) return
    if (!feedback.trim()) { setActionError('Rejection feedback is required.'); return }
    if (!window.confirm('Reject this final submission? The version will become REVIEWED and the student must make corrections.')) return
    actionLock.current = true
    setBusyId(version.id + ':reject-final')
    setActionError('')
    setNotice('')
    try {
      await api.patch('/thesis/versions/' + version.id + '/reject-final', { feedback })
      setNotice('Final submission rejected and returned for corrections.')
      await loadVersions()
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Unable to reject this final submission.'))
      if ([400, 403, 404, 409].includes(requestError.response?.status)) await loadVersions()
    } finally {
      actionLock.current = false
      setBusyId(null)
    }
  }

  const approvalUnavailableReason = (status) => {
    if (status.loadingError) return status.loadingError
    if (status.available === true) return 'A final decision is available.'
    if (status.versionStatus && status.versionStatus !== 'SUBMITTED') return `This version is ${formatStatus(status.versionStatus)}; final approval requires SUBMITTED.`
    if (status.thesisStatus && status.thesisStatus !== 'IN_PROGRESS') return `The thesis is ${formatStatus(status.thesisStatus)}; final approval requires IN PROGRESS.`
    if (!status.submittedAt) return 'The backend has not recorded a submission date for this version.'
    if (status.evaluationDeadline && new Date(status.evaluationDeadline) < new Date()) return 'The seven calendar day final approval deadline has passed.'
    return 'The backend reports that final approval is unavailable.'
  }

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading thesis versions…</div>

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Mentor workspace</span><h1>Thesis versions</h1><p>Review submitted drafts and give version-specific feedback.</p></header>
    <p><Link className="student-text-link" to="/mentor/theses">← Back to my theses</Link></p>
    {error && <section className="state-card" role="alert"><h2>Versions unavailable</h2><p>{error}</p><button type="button" className="button button-primary" onClick={() => { setLoading(true); loadVersions() }}>Try again</button></section>}
    {!error && thesis && <>
      <section className="student-panel">
        <span className="eyebrow">{fullName(thesis.student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2>
        <dl className="student-detail-list mentor-thesis-details">
          <div><dt>Student email</dt><dd>{thesis.student?.email || 'Not provided'}</dd></div>
          <div><dt>Student number</dt><dd>{thesis.student?.studentProfile?.studentNumber || 'Not provided'}</dd></div>
          <div><dt>Thesis status</dt><dd>{formatStatus(thesis.status)}</dd></div>
        </dl>
      </section>
      {notice && <div className="notice success" role="status">{notice}</div>}
      {actionError && <div className="notice error" role="alert">{actionError}</div>}
      <section className="version-section" aria-labelledby="mentor-version-list-title">
        <div className="mentor-request-section-heading"><div><span className="eyebrow">Document history</span><h2 id="mentor-version-list-title">Uploaded versions</h2></div><button className="button button-quiet" type="button" onClick={() => { setLoading(true); loadVersions() }} disabled={busyId !== null}>Refresh</button></div>
        {versions.length === 0 ? <div className="mentor-request-state">No thesis versions have been uploaded yet.</div> : <div className="version-list">{versions.map((version) => <article className="student-panel version-card" key={version.id}>
          <div className="version-card-heading"><div><span className="eyebrow">Version {version.versionNumber}</span><h3>{version.fileName || `Thesis version ${version.versionNumber}`}</h3></div><span className={`request-status status-${String(version.status || '').toLowerCase()}`}>{formatStatus(version.status)}</span></div>
          <dl className="student-detail-list"><div><dt>Uploaded</dt><dd>{version.uploadedAt ? new Date(version.uploadedAt).toLocaleString() : 'Not provided'}</dd></div><div><dt>Current version</dt><dd>{version.isCurrent ? 'Yes' : 'No'}</dd></div><div><dt>Uploaded by</dt><dd>{fullName(version.uploader)}{version.uploader?.email ? ` · ${version.uploader.email}` : ''}</dd></div></dl>
          <div className="version-actions"><button type="button" className="button button-primary" onClick={() => viewVersion(version)} disabled={!version.filePath || busyId !== null}>{busyId === `${version.id}:view` ? 'Opening…' : 'View PDF'}</button></div>
          {version.feedback && <div className="version-feedback"><span className="eyebrow">Feedback submitted</span><p>{version.feedback.comment}</p></div>}
          {version.status === 'APPROVED' && <section className="version-feedback" aria-label={`Final approval for version ${version.versionNumber}`}><span className="eyebrow">Final approval</span><p>Approved</p>{thesis.mentorFinalEvaluation && <p>{thesis.mentorFinalEvaluation}</p>}{thesis.finalGrade != null && <p>Final grade: {thesis.finalGrade}</p>}</section>}
          {version.status === 'SUBMITTED' && version.submittedAt && <section className="version-feedback" aria-label={`Final approval status for version ${version.versionNumber}`}>
            <span className="eyebrow">Final decision status</span>
            {finalApprovalStatus[version.id] ? <>
              <dl className="student-detail-list"><div><dt>Version status</dt><dd>{formatStatus(finalApprovalStatus[version.id].versionStatus)}</dd></div><div><dt>Thesis status</dt><dd>{formatStatus(finalApprovalStatus[version.id].thesisStatus)}</dd></div><div><dt>Submitted</dt><dd>{finalApprovalStatus[version.id].submittedAt ? new Date(finalApprovalStatus[version.id].submittedAt).toLocaleString() : 'Not recorded'}</dd></div><div><dt>Evaluation deadline</dt><dd>{finalApprovalStatus[version.id].evaluationDeadline ? new Date(finalApprovalStatus[version.id].evaluationDeadline).toLocaleString() : 'Not provided'}</dd></div><div><dt>Final approval</dt><dd>{finalApprovalStatus[version.id].available === true ? 'Available' : 'Unavailable'}</dd></div></dl>
              {finalApprovalStatus[version.id].available !== true && <p>{approvalUnavailableReason(finalApprovalStatus[version.id])}</p>}
            </> : <p role="status">Loading final approval status…</p>}
          </section>}
          {version.status === 'SUBMITTED' && version.submittedAt && finalApprovalStatus[version.id]?.available === true && thesis.status === 'IN_PROGRESS' && <><form className="mentor-feedback-form" onSubmit={(event) => approveFinal(event, version)}>
            <span className="eyebrow">Mentor final approval</span>
            <label htmlFor={`final-evaluation-${version.id}`}>Mentor final evaluation <span className="optional-label">(optional)</span></label>
            <textarea id={`final-evaluation-${version.id}`} rows="4" value={finalEvaluations[version.id] || ''} onChange={(event) => setFinalEvaluations((current) => ({ ...current, [version.id]: event.target.value }))} placeholder="Add a final evaluation" disabled={busyId !== null} />
            <label htmlFor={`final-grade-${version.id}`}>Final grade <span className="optional-label">(optional, 6–10)</span></label>
            <input id={`final-grade-${version.id}`} type="number" min="6" max="10" step="any" value={finalGrades[version.id] || ''} onChange={(event) => setFinalGrades((current) => ({ ...current, [version.id]: event.target.value }))} disabled={busyId !== null} />
            <button className="button button-secondary" type="submit" disabled={busyId !== null}>{busyId === `${version.id}:approve-final` ? 'Approving…' : 'Approve Final'}</button>
          </form><form className="mentor-feedback-form" onSubmit={(event) => rejectFinal(event, version)}>
            <span className="eyebrow">Reject final submission</span><p>Rejecting the final submission sends this version back to REVIEWED and requires the student to make corrections.</p>
            <label htmlFor={`rejection-feedback-${version.id}`}>Required feedback</label>
            <textarea id={`rejection-feedback-${version.id}`} rows="4" required value={rejectionFeedback[version.id] || ''} onChange={(event) => setRejectionFeedback((current) => ({ ...current, [version.id]: event.target.value }))} placeholder="Explain what needs to be corrected" disabled={busyId !== null} />
            <button className="button button-secondary" type="submit" disabled={busyId !== null || !(rejectionFeedback[version.id] || '').trim()}>{busyId === `${version.id}:reject-final` ? 'Rejecting…' : 'Reject Final'}</button>
          </form></>}
          {version.status === 'SUBMITTED' && !version.submittedAt && thesis.status === 'IN_PROGRESS' && <form className="mentor-feedback-form" onSubmit={(event) => submitFeedback(event, version)}>
            <label htmlFor={`feedback-${version.id}`}>Review feedback</label>
            <textarea id={`feedback-${version.id}`} rows="4" required value={comments[version.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [version.id]: event.target.value }))} placeholder="Share feedback for this submitted version" disabled={busyId !== null} />
            <button className="button button-secondary" type="submit" disabled={busyId !== null || !(comments[version.id] || '').trim()}>{busyId === `${version.id}:feedback` ? 'Submitting…' : 'Submit feedback and mark reviewed'}</button>
          </form>}
        </article>)}</div>}
      </section>
    </>}
  </div>
}
