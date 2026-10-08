import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

export default function Programs() {
  const [programs, setPrograms] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/study-programs')
      setPrograms(Array.isArray(data.programs) ? data.programs : [])
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to load study programs.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const request = window.setTimeout(load, 0); return () => window.clearTimeout(request) }, [load])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return programs.filter((program) => (!normalized || `${program.name} ${program.department || ''} ${program.degreeLevel || ''}`.toLowerCase().includes(normalized))
      && (status === 'ALL' || program.status === status))
  }, [programs, query, status])

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = { name: form.name, department: form.department, degreeLevel: form.degreeLevel, status: form.status }
      if (form.id) await api.patch(`/admin/study-programs/${form.id}`, payload)
      else await api.post('/admin/study-programs', payload)
      setForm(null)
      setNotice('Study program saved.')
      await load()
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to save the study program.')) }
    finally { setSaving(false) }
  }

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Admin workspace</span><h1>Study programs</h1><p>Review program details, active status, and the number of associated accounts.</p></header>
    {error && <div className="notice error" role="alert">{error} <button className="button button-quiet" type="button" onClick={load}>Try again</button></div>}
    {notice && <div className="notice success" role="status">{notice}</div>}
    <section className="mentor-request-section" aria-labelledby="programs-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Program directory</span><h2 id="programs-heading">All study programs</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{filtered.length} of {programs.length}</span><button className="button button-quiet" type="button" onClick={() => { setForm({ id: null, name: '', department: '', degreeLevel: '', status: 'ACTIVE' }); setError('') }}>Add program</button><button className="button button-quiet" type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {form && <form className="student-panel form-stack" onSubmit={submit}><div className="version-card-heading"><div><span className="eyebrow">{form.id ? 'Edit program' : 'New program'}</span><h2>{form.id ? 'Update study program' : 'Add a study program'}</h2></div><button className="button button-quiet" type="button" onClick={() => setForm(null)}>Cancel</button></div><label className="field">Program name<input required maxLength={150} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><div className="form-row"><label className="field">Department<input maxLength={150} value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} /></label><label className="field">Degree level<input maxLength={50} value={form.degreeLevel} onChange={(event) => setForm((current) => ({ ...current, degreeLevel: event.target.value }))} /></label><label className="field">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div><div><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save program'}</button></div></form>}
      <div className="form-row"><label className="field">Search programs<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, department, or degree" /></label><label className="field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading study programs…</div> : filtered.length === 0 ? <div className="mentor-request-state">{programs.length ? 'No programs match these filters.' : 'There are no study programs yet.'}</div> : <div className="version-list">{filtered.map((program) => <article className="student-panel" key={program.id}><div className="version-card-heading"><div><span className="eyebrow">{program.degreeLevel || 'Degree level not provided'}</span><h2>{program.name}</h2></div><div className="mentor-request-toolbar"><span className={`request-status ${program.status === 'ACTIVE' ? 'status-submitted' : ''}`}>{program.status || 'Unknown'}</span><button className="button button-quiet" type="button" onClick={() => setForm({ id: program.id, name: program.name, department: program.department || '', degreeLevel: program.degreeLevel || '', status: program.status || 'ACTIVE' })}>Edit</button></div></div><dl className="student-detail-list"><div><dt>Department</dt><dd>{program.department || 'Not provided'}</dd></div><div><dt>Associated accounts</dt><dd>{program._count?.users ?? 0}</dd></div><div><dt>Created</dt><dd>{program.createdAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(program.createdAt)) : 'Not provided'}</dd></div></dl></article>)}</div>}
    </section>
  </div>
}
