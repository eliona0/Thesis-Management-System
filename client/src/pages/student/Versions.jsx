import { useCallback, useEffect, useRef, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const formatStatus = (status) => status ? status.replaceAll('_', ' ') : 'Status unavailable'
const hasActiveVersion = (versions) => versions.some((version) => ['DRAFT', 'SUBMITTED'].includes(version.status))

export default function Versions() {
  const [thesis, setThesis] = useState(null)
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [activeAction, setActiveAction] = useState('')
  const actionLock = useRef(false)

  const loadVersions = useCallback(async () => {
    setLoadError('')
    try {
      const [thesisResponse, versionsResponse] = await Promise.all([
        api.get('/thesis/my-thesis'),
        api.get('/thesis/my-thesis/versions'),
      ])
      setThesis(thesisResponse.data.thesis || null)
      setVersions(Array.isArray(versionsResponse.data.versions) ? versionsResponse.data.versions : [])
    } catch (error) {
      if (error.response?.status === 404) {
        setThesis(null)
        setVersions([])
      } else {
        setLoadError(getApiErrorMessage(error, 'Unable to load thesis versions.'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(loadVersions, 0)
    return () => window.clearTimeout(request)
  }, [loadVersions])

  const refresh = async () => {
    setLoading(true)
    await loadVersions()
  }

  const uploadVersion = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setUploadError('Choose a PDF document to upload.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('The PDF must be 10 MB or smaller.')
      return
    }
    setUploading(true)
    setUploadError('')
    setSuccess('')
    try {
      const formData = new FormData()
      formData.append('thesisFile', file)
      const { data } = await api.post('/thesis/my-thesis/versions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSuccess(data.message || 'Thesis version uploaded successfully.')
      setFile(null)
      form.reset()
      await loadVersions()
    } catch (error) {
      setUploadError(getApiErrorMessage(error, 'Unable to upload this thesis version.'))
    } finally {
      setUploading(false)
    }
  }

  const viewVersion = async (version) => {
    if (!version.filePath || actionLock.current) return
    const preview = window.open('', '_blank')
    if (!preview) {
      setActionError('Allow pop-ups to open the thesis PDF.')
      return
    }
    preview.opener = null
    actionLock.current = true
    setActiveAction(`${version.id}:view`)
    setActionError('')
    try {
      const fileUrl = new URL(version.filePath, api.defaults.baseURL).toString()
      const { data } = await api.get(fileUrl, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(data)
      preview.location.href = blobUrl
      preview.addEventListener('pagehide', () => URL.revokeObjectURL(blobUrl), { once: true })
    } catch (error) {
      preview.close()
      setActionError(getApiErrorMessage(error, 'Unable to open this thesis PDF.'))
    } finally {
      actionLock.current = false
      setActiveAction('')
    }
  }

  const deleteVersion = async (version) => {
    if (version.status !== 'DRAFT' || thesis?.status !== 'IN_PROGRESS' || actionLock.current || !window.confirm('Permanently delete this draft thesis file? This action cannot be undone.')) return
    actionLock.current = true
    setActiveAction(`${version.id}:delete`)
    setActionError('')
    setSuccess('')
    try {
      const { data } = await api.delete(`/thesis/my-thesis/versions/${version.id}`)
      setSuccess(data.message || 'Draft thesis version deleted.')
      await loadVersions()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to delete this thesis version.'))
    } finally {
      actionLock.current = false
      setActiveAction('')
    }
  }

  const submitVersion = async (version) => {
    if (version.status !== 'DRAFT' || thesis?.status !== 'IN_PROGRESS' || actionLock.current || !window.confirm('Submit this thesis version for review? After submission, you will not be able to delete it.')) return
    actionLock.current = true
    setActiveAction(`${version.id}:submit`)
    setActionError('')
    setSuccess('')
    try {
      const { data } = await api.patch(`/thesis/my-thesis/versions/${version.id}/submit`)
      setSuccess(data.message || 'Thesis version submitted for review.')
      await loadVersions()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to submit this thesis version for review.'))
    } finally {
      actionLock.current = false
      setActiveAction('')
    }
  }

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your thesis versions…</div>
  if (loadError) return <section className="state-card" role="alert"><span className="eyebrow">Versions unavailable</span><h1>We couldn’t load your versions.</h1><p>{loadError}</p><button type="button" className="button button-primary" onClick={refresh}>Try again</button></section>

  const canUpload = thesis?.status === 'IN_PROGRESS' && !hasActiveVersion(versions)

  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Student workspace</span><h1>Thesis versions</h1><p>Upload and review the documents attached to your thesis.</p></header>
    {!thesis ? <section className="state-card"><span className="eyebrow">Thesis record</span><h1>No thesis record yet</h1><p>Your thesis versions will appear here once a thesis has been created for your account.</p></section> : <>
      <section className="student-panel" aria-labelledby="version-upload-title">
        <div className="student-panel-heading"><div><span className="eyebrow">Current thesis</span><h2 id="version-upload-title">{thesis.title || 'Untitled thesis'}</h2></div><span className="request-status">{formatStatus(thesis.status)}</span></div>
        {thesis.status !== 'IN_PROGRESS' && <p className="thesis-readonly-note">Uploading is available after your mentor moves the thesis to In Progress.</p>}
        {thesis.status === 'IN_PROGRESS' && hasActiveVersion(versions) && <p className="thesis-readonly-note">A draft or submitted version is already active. You can upload another version after it is no longer active.</p>}
        {success && <p className="notice success" role="status">{success}</p>}
        {uploadError && <p className="notice error" role="alert">{uploadError}</p>}
        <form className="version-upload-form" onSubmit={uploadVersion}>
          <label className="field" htmlFor="thesis-version-file">PDF document<input id="thesis-version-file" type="file" accept="application/pdf,.pdf" required disabled={!canUpload || uploading} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <p className="version-upload-help">PDF only, up to 10 MB.</p>
          <button type="submit" className="button button-primary" disabled={!canUpload || !file || uploading}>{uploading ? 'Uploading…' : 'Upload version'}</button>
        </form>
      </section>
      <section className="version-section" aria-labelledby="version-list-title">
        {actionError && <p className="notice error" role="alert">{actionError}</p>}
        <div className="mentor-request-section-heading"><div><span className="eyebrow">Document history</span><h2 id="version-list-title">Uploaded versions</h2></div><span className="mentor-count">{versions.length} {versions.length === 1 ? 'version' : 'versions'}</span></div>
        {versions.length === 0 ? <div className="mentor-request-state">No thesis versions have been uploaded yet.</div> : <div className="version-list">{versions.map((version) => <article className="student-panel version-card" key={version.id}>
          <div className="version-card-heading"><div><span className="eyebrow">Version {version.versionNumber}</span><h3>{version.fileName || `Thesis version ${version.versionNumber}`}</h3></div><span className={`request-status status-${String(version.status || '').toLowerCase()}`}>{formatStatus(version.status)}</span></div>
          <dl className="student-detail-list"><div><dt>Uploaded</dt><dd>{version.uploadedAt ? new Date(version.uploadedAt).toLocaleString() : 'Not provided'}</dd></div><div><dt>Current version</dt><dd>{version.isCurrent ? 'Yes' : 'No'}</dd></div></dl>
          <div className="version-actions">
            <button type="button" className="button button-primary" onClick={() => viewVersion(version)} disabled={!version.filePath || Boolean(activeAction)}>{activeAction === `${version.id}:view` ? 'Opening…' : 'View PDF'}</button>
            {version.status === 'DRAFT' && thesis.status === 'IN_PROGRESS' && <>
              <button type="button" className="button button-secondary" onClick={() => submitVersion(version)} disabled={Boolean(activeAction)}>{activeAction === `${version.id}:submit` ? 'Submitting…' : 'Submit for Review'}</button>
              <button type="button" className="button button-secondary" onClick={() => deleteVersion(version)} disabled={Boolean(activeAction)}>{activeAction === `${version.id}:delete` ? 'Deleting…' : 'Delete'}</button>
            </>}
          </div>
        </article>)}</div>}
      </section>
    </>}
  </div>
}
