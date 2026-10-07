import { useEffect, useState } from 'react'
import useAuth from '../../context/useAuth'
import api, { getApiErrorMessage } from '../../services/api'

const display = (value) => value || 'Not provided'

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.get('/student/profile')
      .then(({ data }) => { if (active) setProfile(data.student || null) })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load your profile.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  if (loading) return <div className="screen-state" role="status"><span className="spinner" />Loading your profile…</div>
  if (error) return <section className="state-card" role="alert"><span className="eyebrow">Profile unavailable</span><h1>We couldn’t load your profile.</h1><p>{error}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></section>
  const student = profile || user || {}
  const name = [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Student'
  return <div className="student-page"><header className="page-heading"><span className="eyebrow">Student account</span><h1>Your profile</h1><p>Personal information currently available to the application.</p></header>
    {profile ? <section className="student-panel profile-card"><div className="profile-avatar" aria-hidden="true">{name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><span className="eyebrow">Student</span><h2>{name}</h2><p>{display(student.email)}</p></div><dl className="student-detail-list profile-details"><div><dt>Study program</dt><dd>{display(student.studyProgram)}</dd></div><div><dt>Student number</dt><dd>{display(student.studentNumber)}</dd></div><div><dt>Account role</dt><dd>{display(student.role)}</dd></div></dl><p className="profile-note">Profile editing is not available through the current student profile endpoint.</p></section> : <section className="state-card"><h2>Profile details are unavailable</h2><p>Signed-in account: {display(name)} ({display(student.email)}).</p></section>}
  </div>
}
