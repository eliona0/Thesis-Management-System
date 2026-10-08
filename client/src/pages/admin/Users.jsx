import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'
import useAuth from '../../context/useAuth'

const fullName = (user) => [user.firstName, user.lastName].filter(Boolean).join(' ')
const label = (value) => value?.replaceAll('_', ' ') || 'Not provided'

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('ALL')
  const [program, setProgram] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/users')
      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to load users.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const request = window.setTimeout(load, 0); return () => window.clearTimeout(request) }, [load])
  const toggleAccount = async (user) => {
    const nextStatus = !user.isActive
    const action = nextStatus ? 'reactivate' : 'deactivate'
    if (savingId !== null || !window.confirm(`Are you sure you want to ${action} ${fullName(user)}?`)) return
    setSavingId(user.id)
    setError('')
    try {
      await api.patch(`/admin/users/${user.id}/status`, { isActive: nextStatus })
      await load()
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Unable to update account status.')) }
    finally { setSavingId(null) }
  }
  const roles = useMemo(() => [...new Set(users.map((user) => user.role?.name).filter(Boolean))].sort(), [users])
  const programs = useMemo(() => [...new Set(users.map((user) => user.studyProgram?.name).filter(Boolean))].sort(), [users])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return users.filter((user) => (!normalized || `${fullName(user)} ${user.email} ${user.studyProgram?.name || ''}`.toLowerCase().includes(normalized))
      && (role === 'ALL' || user.role?.name === role)
      && (status === 'ALL' || String(user.isActive) === status)
      && (program === 'ALL' || user.studyProgram?.name === program))
  }, [users, query, role, status, program])

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Admin workspace</span><h1>Users</h1><p>Browse account roles, study programs, and account status.</p></header>
    {error && <div className="notice error" role="alert">{error} <button className="button button-quiet" type="button" onClick={load}>Try again</button></div>}
    <section className="mentor-request-section" aria-labelledby="users-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Account directory</span><h2 id="users-heading">All users</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{filtered.length} of {users.length}</span><button className="button button-quiet" type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      <div className="form-row"><label className="field">Search accounts<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or program" /></label><label className="field">Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="ALL">All roles</option>{roles.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label className="field">Study program<select value={program} onChange={(event) => setProgram(event.target.value)}><option value="ALL">All programs</option>{programs.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="field">Account status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label></div>
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading users…</div> : filtered.length === 0 ? <div className="mentor-request-state">{users.length ? 'No users match these filters.' : 'There are no user accounts yet.'}</div> : <div className="version-list">{filtered.map((user) => <article className="student-panel" key={user.id}><div className="version-card-heading"><div><span className="eyebrow">{label(user.role?.name)}</span><h2>{fullName(user)}</h2></div><div className="mentor-request-toolbar"><span className={`request-status ${user.isActive ? 'status-submitted' : ''}`}>{user.isActive ? 'Active' : 'Inactive'}</span>{currentUser?.id !== user.id && <button className={`button ${user.isActive ? 'button-reject' : 'button-quiet'}`} type="button" onClick={() => toggleAccount(user)} disabled={savingId !== null}>{savingId === user.id ? 'Saving…' : user.isActive ? 'Deactivate' : 'Reactivate'}</button>}</div></div><dl className="student-detail-list"><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Study program</dt><dd>{user.studyProgram?.name || 'Not assigned'}</dd></div><div><dt>Joined</dt><dd>{user.createdAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(user.createdAt)) : 'Not provided'}</dd></div></dl><details><summary>Profile information</summary><dl className="student-detail-list">{user.studentProfile && <><div><dt>Student number</dt><dd>{user.studentProfile.studentNumber}</dd></div><div><dt>Study year</dt><dd>{user.studentProfile.studyYear ?? 'Not provided'}</dd></div><div><dt>Verification</dt><dd>{user.studentProfile.verificationStatus || 'Not provided'}</dd></div></>}{user.mentorProfile && <><div><dt>Academic title</dt><dd>{user.mentorProfile.academicTitle || 'Not provided'}</dd></div><div><dt>Department</dt><dd>{user.mentorProfile.department || 'Not provided'}</dd></div><div><dt>Availability</dt><dd>{user.mentorProfile.isAvailable ? 'Available' : 'Unavailable'}</dd></div></>}{user.committeeMemberProfile && <><div><dt>Academic title</dt><dd>{user.committeeMemberProfile.academicTitle || 'Not provided'}</dd></div><div><dt>Department</dt><dd>{user.committeeMemberProfile.department || 'Not provided'}</dd></div></>}</dl></details></article>)}</div>}
    </section>
  </div>
}
