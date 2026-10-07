import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/Button'
import api, { getApiErrorMessage } from '../../services/api'

export default function Register() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [programsError, setProgramsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', studentNumber: '', studyProgramId: '', password: '', confirmPassword: '' })

  useEffect(() => {
    let active = true
    api.get('/study-programs')
      .then(({ data }) => { if (active) setPrograms(data.programs || []) })
      .catch((requestError) => { if (active) setProgramsError(getApiErrorMessage(requestError, 'Could not load study programs. Please try again later.')) })
      .finally(() => { if (active) setProgramsLoading(false) })
    return () => { active = false }
  }, [])

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/register', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        studentNumber: form.studentNumber.trim(),
        studyProgramId: Number(form.studyProgramId),
        password: form.password,
      })
      navigate('/login', { replace: true, state: { notice: 'Your student account is ready. Sign in to continue.' } })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to create your account. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const noPrograms = !programsLoading && !programsError && programs.length === 0

  return (
    <div className="auth-card-wrap register-card">
      <div className="auth-card-heading">
        <span className="eyebrow">Student registration</span>
        <h2>Create your account</h2>
        <p>Register with your student details and study program.</p>
      </div>
      {programsError && <div className="notice error" role="alert">{programsError}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {noPrograms && <div className="notice info" role="status">There are no active study programs available right now.</div>}
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field"><span>First name</span><input name="firstName" autoComplete="given-name" value={form.firstName} onChange={update} required /></label>
          <label className="field"><span>Last name</span><input name="lastName" autoComplete="family-name" value={form.lastName} onChange={update} required /></label>
        </div>
        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required placeholder="name@university.edu" /></label>
        <label className="field"><span>Student number</span><input name="studentNumber" autoComplete="off" value={form.studentNumber} onChange={update} required /></label>
        <label className="field">
          <span>Study program</span>
          <select name="studyProgramId" value={form.studyProgramId} onChange={update} required disabled={programsLoading || programsError || noPrograms}>
            <option value="">{programsLoading ? 'Loading programs…' : 'Choose your program'}</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} required /></label>
        <label className="field"><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update} required /></label>
        <Button type="submit" loading={loading} disabled={programsLoading || Boolean(programsError) || noPrograms} className="button-primary button-full">Create student account</Button>
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </div>
  )
}
