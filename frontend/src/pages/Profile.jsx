import React, { useState } from 'react'
import { UserCircle, Mail, Users, Bell, RefreshCw, Plus, Trash2, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useApp, SUPPORTED_CURRENCIES } from '../context/AppContext.jsx'
import { Field, inputClass, Button } from '../components/Bits.jsx'

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 border-b border-line last:border-b-0 cursor-pointer">
      <div>
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          checked ? 'bg-pine' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  )
}

const STATUS_META = {
  pending: { label: 'Sending invite…', icon: Clock, className: 'text-muted' },
  sent: { label: 'Invitation sent', icon: CheckCircle2, className: 'text-pine' },
  accepted: { label: 'Accepted', icon: CheckCircle2, className: 'text-pine' },
  failed: { label: 'Invite failed', icon: AlertCircle, className: 'text-brick' },
}

function InviteStatus({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  const Icon = meta.icon
  return (
    <span className={`flex items-center gap-1 text-xs ${meta.className}`}>
      <Icon size={12} /> {meta.label}
    </span>
  )
}

export default function Profile() {
  const { profile, updateProfile, updateNotifications, addMember, removeMember, resendInvite, reload } = useApp()
  const [familyName, setFamilyName] = useState(profile.familyName)
  const [email, setEmail] = useState(profile.email)
  const [currency, setCurrency] = useState(profile.currency)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberError, setMemberError] = useState('')
  const [adding, setAdding] = useState(false)

  const saveInfo = (e) => {
    e.preventDefault()
    updateProfile({ familyName, email, currency })
  }

  const submitMember = async (e) => {
    e.preventDefault()
    setMemberError('')
    if (!memberName.trim()) return
    if (!memberEmail.trim() || !memberEmail.includes('@')) {
      setMemberError('Enter a valid email — that\'s where the invitation will be sent.')
      return
    }
    setAdding(true)
    try {
      await addMember({ name: memberName.trim(), email: memberEmail.trim() })
      setMemberName('')
      setMemberEmail('')
    } catch (err) {
      setMemberError(err.message || 'Could not add member')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="ledger-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-pine/10 flex items-center justify-center text-pine">
            <UserCircle size={22} />
          </div>
          <p className="font-display text-lg">Household Details</p>
        </div>
        <form onSubmit={saveInfo} className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Family name">
            <input className={inputClass} value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          </Field>
          <Field label="Notification email">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Save Details</Button>
          </div>
        </form>
      </div>

      <div className="ledger-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold-dark">
            <Users size={20} />
          </div>
          <p className="font-display text-lg">Family Members</p>
        </div>

        {profile.members.length === 0 ? (
          <p className="text-sm text-muted mb-4">No family members added yet.</p>
        ) : (
          <ul className="divide-y divide-line mb-4">
            {profile.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm gap-3">
                <div>
                  <p className="text-ink">
                    {m.name} <span className="text-muted text-xs">— {m.role}</span>
                  </p>
                  <p className="text-xs text-muted">{m.email}</p>
                  <InviteStatus status={m.invitationStatus} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {m.invitationStatus === 'failed' && (
                    <button
                      onClick={() => resendInvite(m.id)}
                      className="p-1.5 rounded-md hover:bg-black/5 text-pine"
                      aria-label="Resend invitation"
                      title="Resend invitation"
                    >
                      <Send size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-1.5 rounded-md hover:bg-black/5 text-muted hover:text-brick"
                    aria-label="Remove member"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submitMember} className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputClass}
              placeholder="Name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
            />
            <input
              type="email"
              className={inputClass}
              placeholder="Email — sends them an invite"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={adding} className="shrink-0">
              <Plus size={15} /> {adding ? 'Adding…' : 'Add & Invite'}
            </Button>
          </div>
          {memberError && <p className="text-xs text-brick">{memberError}</p>}
          <p className="text-xs text-muted">
            Adding a member sends an invitation email to the address you enter, so they know they've been added to the household's shared account.
          </p>
        </form>
      </div>

      <div className="ledger-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-brick/10 flex items-center justify-center text-brick">
            <Bell size={20} />
          </div>
          <p className="font-display text-lg">Email Reminders</p>
        </div>
        <p className="text-xs text-muted mb-2 flex items-center gap-1.5">
          <Mail size={12} /> Sent to {profile.email || 'no email set'} and any invited members
        </p>
        <div>
          <Toggle
            checked={profile.notifications.monthlyReminder}
            onChange={(v) => updateNotifications({ monthlyReminder: v })}
            label="Monthly summary email"
            hint={'"Where did our money go?" — sent at the end of every month'}
          />
          <Toggle
            checked={profile.notifications.weeklySummary}
            onChange={(v) => updateNotifications({ weeklySummary: v })}
            label="Weekly summary email"
            hint="A short recap every week"
          />
          <Toggle
            checked={profile.notifications.billReminders}
            onChange={(v) => updateNotifications({ billReminders: v })}
            label="Upcoming bill reminders"
            hint="Rent, internet, tuition, subscriptions, and loan payments"
          />
          <Toggle
            checked={profile.notifications.spendingAlerts}
            onChange={(v) => updateNotifications({ spendingAlerts: v })}
            label="Spending pace alerts"
            hint={`Notify when spending crosses ${profile.notifications.reminderThreshold}% of income`}
          />
        </div>
      </div>

      <div className="ledger-card p-6 flex items-center justify-between">
        <div>
          <p className="font-display text-lg">Refresh Data</p>
          <p className="text-xs text-muted">Reload everything from the server.</p>
        </div>
        <Button variant="secondary" onClick={reload}>
          <RefreshCw size={15} /> Reload
        </Button>
      </div>
    </div>
  )
}
