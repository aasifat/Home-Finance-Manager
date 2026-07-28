import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, Receipt, Mail, Wallet, TrendingUp, Inbox } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const TYPE_META = {
  bill: { icon: Receipt, className: 'text-gold-dark bg-gold/15' },
  invite: { icon: Mail, className: 'text-brick bg-brick/10' },
  budget: { icon: Wallet, className: 'text-brick bg-brick/10' },
  spending: { icon: TrendingUp, className: 'text-brick bg-brick/10' },
}

function AlertRow({ alert }) {
  const meta = TYPE_META[alert.type] || TYPE_META.bill
  const Icon = meta.icon
  return (
    <li className="flex items-start gap-3 px-4 py-3 border-b border-line last:border-b-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.className}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink truncate">{alert.title}</p>
        <p className="text-xs text-muted">{alert.message}</p>
      </div>
    </li>
  )
}

export default function Topbar({ onMenuClick, title }) {
  const { profile, alerts } = useApp()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const count = alerts.length

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-paper/90 backdrop-blur border-b border-line px-4 sm:px-8 py-4">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-black/5"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="font-display text-xl sm:text-2xl text-ink leading-tight">{title}</p>
          <p className="text-xs text-muted">
            {profile.familyName}
            {user?.fullName ? ` · ${user.fullName}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={panelRef}>
          <button
            className="relative p-2 rounded-full hover:bg-black/5"
            aria-label="Notifications"
            onClick={() => setOpen((o) => !o)}
          >
            <Bell size={19} className="text-pine" />
            {count > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[10px] leading-4 text-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] ledger-card overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-line">
                <p className="font-display text-sm">Notifications</p>
              </div>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-2 py-8 px-4">
                  <Inbox size={20} className="text-muted" />
                  <p className="text-xs text-muted">You're all caught up.</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {alerts.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          className="hidden sm:flex items-center gap-1.5 p-2 rounded-full hover:bg-black/5 text-muted hover:text-brick"
          onClick={handleLogout}
          aria-label="Log out"
          title={user?.fullName ? `Log out (${user.fullName})` : 'Log out'}
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}
