import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Field, inputClass, Button } from '../components/Bits.jsx'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Enter your full name.')
      return
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password, confirmPassword: confirm })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setError(err.message || 'Could not create your account')
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
          <p className="font-display text-xl">Create your account</p>
          <p className="text-xs text-muted">Register to sign in to your household's finances.</p>
        </div>

        <form onSubmit={submit}>
          <Field label="Full name">
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              autoFocus
              required
            />
          </Field>
          <Field label="Email address">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password (min. 8 characters)">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>

          {error && <p className="text-xs text-brick mb-4">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full justify-center">
            <UserPlus size={15} />
            {submitting ? 'Creating account…' : 'Register'}
          </Button>
        </form>

        <p className="text-xs text-muted text-center mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-pine font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
