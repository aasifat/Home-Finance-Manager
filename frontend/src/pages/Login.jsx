import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Field, inputClass, Button } from '../components/Bits.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const justRegistered = location.state?.registered

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper text-ink px-4">
      <div className="ledger-card w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <div className="w-11 h-11 rounded-full bg-gold flex items-center justify-center text-pine-dark">
            <BookOpen size={20} strokeWidth={2.2} />
          </div>
          <p className="font-display text-xl">Ledger</p>
          <p className="text-xs text-muted">Sign in to your household finances.</p>
        </div>

        {justRegistered && (
          <p className="text-xs text-pine bg-pine/5 border border-pine/20 rounded-lg px-3 py-2 mb-4 text-center">
            Account created — sign in with your new email and password.
          </p>
        )}

        <form onSubmit={submit}>
          <Field label="Email address">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && <p className="text-xs text-brick mb-4">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full justify-center">
            <LogIn size={15} />
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs text-muted text-center mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-pine font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
