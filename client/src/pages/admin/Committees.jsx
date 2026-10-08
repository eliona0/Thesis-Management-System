import { useCallback, useEffect, useState } from 'react'
import api, { getApiErrorMessage } from '../../services/api'

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Student'
const committeeSlots = [
  { role: 'CHAIR', label: 'Committee chair' },
  { role: 'MEMBER', label: 'Committee member 1' },
  { role: 'MEMBER', label: 'Committee member 2' },
]
const displayStatus = (value) => value?.replaceAll('_', ' ') || 'Unknown'

export default function Committees() {
  const [theses, setTheses] = useState([])
  const [members, setMembers] = useState([])
  const [committees, setCommittees] = useState([])
  const [selection, setSelection] = useState({ thesisId: '', memberIds: ['', '', ''] })
  const [defenseDates, setDefenseDates] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPage = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [eligibleResult, membersResult, committeesResult] = await Promise.all([
        api.get('/committee/eligible-theses'), api.get('/committee/members'), api.get('/committee/admin'),
      ])
      setTheses(Array.isArray(eligibleResult.data.theses) ? eligibleResult.data.theses : [])
      setMembers(Array.isArray(membersResult.data.members) ? membersResult.data.members : [])
      setCommittees(Array.isArray(committeesResult.data.committees) ? committeesResult.data.committees : [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load Committee information.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => loadPage(), 0)
    return () => window.clearTimeout(request)
  }, [loadPage])

  const setMember = (index, value) => setSelection((current) => {
    const memberIds = [...current.memberIds]
    memberIds[index] = value
    return { ...current, memberIds }
  })

  const createCommittee = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!selection.thesisId || selection.memberIds.some((id) => !id) || new Set(selection.memberIds).size !== 3) {
      setError('Choose a submitted thesis and three different Committee Members.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const membersPayload = committeeSlots.map((slot, index) => ({ committeeMemberId: Number(selection.memberIds[index]), role: slot.role }))
      await api.post(`/committee/thesis/${selection.thesisId}`, { members: membersPayload })
      setSelection({ thesisId: '', memberIds: ['', '', ''] })
      setNotice('Committee assigned successfully. The thesis remains submitted.')
      await loadPage(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to assign this Committee.'))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadPage(false)
    } finally {
      setSaving(false)
    }
  }

  const scheduleDefense = async (committee) => {
    const value = defenseDates[committee.thesisId]
    if (!value) {
      setError('Choose a future defense date before scheduling.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.patch(`/committee/thesis/${committee.thesisId}/schedule`, { defenseDate: new Date(value).toISOString() })
      setNotice('Defense scheduled. Committee Members can submit evaluations on or after the defense date.')
      await loadPage(false)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to schedule this defense.'))
      if ([400, 404, 409].includes(requestError.response?.status)) await loadPage(false)
    } finally {
      setSaving(false)
    }
  }

  return <div className="mentor-request-page">
    <header className="page-heading"><span className="eyebrow">Admin workspace</span><h1>Committees</h1><p>Assign Committees to finally approved theses and track defense and evaluation progress.</p></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {notice && <div className="notice success" role="status">{notice}</div>}
    <section className="mentor-request-section" aria-labelledby="eligible-theses-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Thesis status: submitted</span><h2 id="eligible-theses-heading">Eligible theses</h2></div><div className="mentor-request-toolbar"><span className="mentor-count">{theses.length} eligible</span><button className="button button-quiet" type="button" onClick={() => loadPage()} disabled={loading || saving}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
      {loading ? <div className="mentor-request-state" role="status"><span className="spinner" />Loading Committee information…</div> : <>
        {theses.length === 0 ? <div className="mentor-request-state">There are no unassigned submitted theses.</div> : <form className="student-panel form-stack" onSubmit={createCommittee}>
          <label className="field">Submitted thesis
            <select value={selection.thesisId} onChange={(event) => setSelection((current) => ({ ...current, thesisId: event.target.value }))} required>
              <option value="">Select a thesis</option>
              {theses.map((thesis) => <option key={thesis.id} value={thesis.id}>{thesis.title} — {fullName(thesis.student)}</option>)}
            </select>
          </label>
          <div className="form-row">{committeeSlots.map((slot, index) => <label className="field" key={slot.label}>{slot.label}
            <select value={selection.memberIds[index]} onChange={(event) => setMember(index, event.target.value)} required>
              <option value="">Select a person</option>
              {members.filter((member) => selection.memberIds[index] === String(member.id) || !selection.memberIds.includes(String(member.id))).map((member) => <option key={member.id} value={member.id}>{fullName(member)} — {member.email}</option>)}
            </select>
          </label>)}</div>
          <div><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Assigning…' : 'Create Committee'}</button></div>
        </form>}
      </>}
    </section>
    <section className="mentor-request-section" aria-labelledby="committees-heading">
      <div className="mentor-request-section-heading"><div><span className="eyebrow">Committee overview</span><h2 id="committees-heading">Assigned Committees</h2></div><span className="mentor-count">{committees.length} total</span></div>
      {!loading && committees.length === 0 ? <div className="mentor-request-state">No Committees have been assigned yet.</div> : <div className="version-list">{committees.map((committee) => {
        const thesis = committee.thesis || {}
        const evaluations = thesis.evaluations || []
        return <article className="student-panel" key={committee.id}>
          <div className="version-card-heading"><div><span className="eyebrow">{fullName(thesis.student)}</span><h2>{thesis.title || 'Untitled thesis'}</h2></div><span className="request-status status-submitted">{displayStatus(committee.status)}</span></div>
          <p>{thesis.description || 'No thesis description provided.'}</p>
          <dl className="student-detail-list">
            <div><dt>Research field</dt><dd>{thesis.researchField || 'Not provided'}</dd></div>
            <div><dt>Thesis status</dt><dd>{displayStatus(thesis.status)}</dd></div>
            <div><dt>Evaluation progress</dt><dd>{evaluations.length} of {committee.members?.length || 0} submitted{committee.status === 'COMPLETED' ? ' — Committee evaluation complete' : ''}</dd></div>
            {committee.defenseDate && <div><dt>Defense date</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(committee.defenseDate))}</dd></div>}
          </dl>
          <h3>Committee Members</h3>
          <ul>{(committee.members || []).map((membership) => {
            const profileId = membership.committeeMemberId
            const evaluation = evaluations.find((item) => item.committeeMemberId === profileId)
            return <li key={membership.id}>{fullName(membership.member?.user)} — {membership.role === 'CHAIR' ? 'Chair' : 'Member'} — {evaluation ? `Evaluated (${evaluation.grade})` : 'Evaluation pending'}</li>
          })}</ul>
          {committee.status === 'ASSIGNED' && <div className="mentor-request-toolbar">
            <label className="field">Defense date<input type="datetime-local" value={defenseDates[committee.thesisId] || ''} onChange={(event) => setDefenseDates((current) => ({ ...current, [committee.thesisId]: event.target.value }))} /></label>
            <button className="button button-primary" type="button" onClick={() => scheduleDefense(committee)} disabled={saving}>Schedule defense</button>
          </div>}
          {evaluations.length > 0 && <details><summary>View submitted evaluations</summary><div className="version-list">{evaluations.map((evaluation) => <section className="student-panel" key={evaluation.id}><strong>{fullName(evaluation.committeeMember?.user)} — Grade {evaluation.grade}</strong><p>{evaluation.comments || 'No comments provided.'}</p><small>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(evaluation.evaluationDate))}</small></section>)}</div></details>}
        </article>
      })}</div>}
    </section>
  </div>
}
