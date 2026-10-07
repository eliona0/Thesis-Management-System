
import { useCallback, useEffect, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const editableStatuses = new Set(['PENDING', 'REJECTED'])
const valueOrFallback = (value) => value || 'Not provided'
const formatStatus = (status) => status ? status.replaceAll('_', ' ') : 'Status unavailable'

export default function Thesis() {
  const [thesis, setThesis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', researchField: '' })

  const fetchThesis = useCallback(async () => {
    try {
      const { data } = await api.get('/thesis/my-thesis')
      setThesis(data.thesis || null)
    } catch (requestError) {
      if (requestError.response?.status === 404) setThesis(null)
      else setError(getApiErrorMessage(requestError, 'Unable to load your thesis.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(fetchThesis, 0)
    return () => window.clearTimeout(request)
  }, [fetchThesis])

  const loadThesis = async () => {
    setLoading(true)
    setError('')
    await fetchThesis()
  }

  const beginEditing = () => {
    setForm({
      title: thesis?.title || '',
      description: thesis?.description || '',
      researchField: thesis?.researchField || '',
    })
    setSaveError('')
    setEditing(true)
  }

  const saveThesis = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const { data } = await api.patch('/thesis/my-thesis', form)
      setThesis(data.thesis || null)
      setEditing(false)
    } catch (requestError) {
      setSaveError(getApiErrorMessage(requestError, 'Unable to save your thesis details.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your thesis…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Thesis unavailable</span><h1>We couldn’t load your thesis.</h1><p>{error}</p><button type="button" className="button button-primary" onClick={loadThesis}>Try again</button></section>

  const mentorName = thesis?.mentor ? [thesis.mentor.firstName, thesis.mentor.lastName].filter(Boolean).join(' ') : ''
  const canEdit = editableStatuses.has(thesis?.status)

  return <div className="student-page">
    <header className="page-heading"><span className="eyebrow">Student workspace</span><h1>Your thesis</h1><p>View your thesis details, mentor, and current workflow status.</p></header>
    {!thesis ? <section className="state-card" aria-labelledby="empty-thesis-title"><span className="eyebrow">Thesis record</span><h1 id="empty-thesis-title">No thesis record yet</h1><p>A thesis will appear here after your mentor request is accepted.</p><button type="button" className="button button-quiet" onClick={loadThesis}>Check again</button></section> : <>
      <section className="student-panel" aria-labelledby="thesis-details-title">
        <div className="student-panel-heading"><div><span className="eyebrow">Thesis details</span><h2 id="thesis-details-title">{thesis.title || 'Untitled thesis'}</h2></div>
          {canEdit && !editing && <button type="button" className="button button-primary" onClick={beginEditing}>Edit details</button>}
        </div>
        <p className="student-status"><span className="status-dot" />{formatStatus(thesis.status)}</p>
        {editing ? <form className="thesis-edit-form" onSubmit={saveThesis}>
          <label htmlFor="thesis-title">Title</label><input id="thesis-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <label htmlFor="thesis-description">Description</label><textarea id="thesis-description" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <label htmlFor="thesis-research-field">Research field</label><input id="thesis-research-field" value={form.researchField} onChange={(event) => setForm({ ...form, researchField: event.target.value })} />
          {saveError && <p className="thesis-form-error" role="alert">{saveError}</p>}
          <div className="thesis-form-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form> : <dl className="student-detail-list thesis-detail-list">
          <div><dt>Description</dt><dd>{valueOrFallback(thesis.description)}</dd></div>
          <div><dt>Research field</dt><dd>{valueOrFallback(thesis.researchField)}</dd></div>
          <div><dt>Mentor</dt><dd>{mentorName || 'Not assigned'}</dd></div>
          <div><dt>Mentor email</dt><dd>{valueOrFallback(thesis.mentor?.email)}</dd></div>
          <div><dt>Created</dt><dd>{thesis.createdAt ? new Date(thesis.createdAt).toLocaleDateString() : 'Not provided'}</dd></div>
          <div><dt>Last updated</dt><dd>{thesis.updatedAt ? new Date(thesis.updatedAt).toLocaleDateString() : 'Not provided'}</dd></div>
        </dl>}
        {!canEdit && <p className="thesis-readonly-note">Thesis details are locked after mentor approval.</p>}
      </section>
      <section className="student-panel student-workflow" aria-labelledby="thesis-status-title"><div><span className="eyebrow">Workflow</span><h2 id="thesis-status-title">Current status</h2><p>Your thesis is {formatStatus(thesis.status).toLowerCase()}.</p></div><div className="workflow-pill">{formatStatus(thesis.status)}</div></section>
    </>}
  </div>
}
