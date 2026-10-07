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
      setVersions(Array.isArray(versionsResponse.data.versions) ? versionsResponse.data.versions : [])
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
          {version.status === 'SUBMITTED' && thesis.status === 'IN_PROGRESS' && <form className="mentor-feedback-form" onSubmit={(event) => submitFeedback(event, version)}>
            <label htmlFor={`feedback-${version.id}`}>Review feedback</label>
            <textarea id={`feedback-${version.id}`} rows="4" required value={comments[version.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [version.id]: event.target.value }))} placeholder="Share feedback for this submitted version" disabled={busyId !== null} />
            <button className="button button-secondary" type="submit" disabled={busyId !== null || !(comments[version.id] || '').trim()}>{busyId === `${version.id}:feedback` ? 'Submitting…' : 'Submit feedback and mark reviewed'}</button>
          </form>}
        </article>)}</div>}
      </section>
    </>}
  </div>
}
