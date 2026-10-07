import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../../components/Button'
import useAuth from '../../context/useAuth'
import { getApiErrorMessage } from '../../services/api'
import { roleHomePath } from '../../routes/rolePaths'

export default function Login() {
  const { login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login({ email: email.trim(), password })
      navigate(roleHomePath(user.role), { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, requestError.message || 'Unable to sign in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card-wrap">
      <div className="auth-card-heading">
        <span className="eyebrow">Welcome back</span>
        <h2>Sign in to your account</h2>
        <p>Use your university account details to continue.</p>
      </div>
      {location.state?.notice && <div className="notice success" role="status">{location.state.notice}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email address</span>
          <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@university.edu" />
        </label>
        <label className="field">
          <span>Password</span>
          <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" />
        </label>
        <Button type="submit" loading={loading} className="button-primary button-full">Sign in</Button>
      </form>
      <p className="auth-switch">New student? <Link to="/register">Create an account</Link></p>
    </div>
  )
}
