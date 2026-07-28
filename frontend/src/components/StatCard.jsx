import React from 'react'

export default function StatCard({ label, value, sub, tone = 'default', icon: Icon, mono = true }) {
  const toneClasses = {
    default: 'text-ink',
    positive: 'text-pine',
    negative: 'text-brick',
    gold: 'text-gold-dark',
  }
  return (
    <div className="ledger-card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted font-medium">{label}</p>
        {Icon && <Icon size={16} className="text-muted" />}
      </div>
      <p
        className={`${mono ? 'font-mono font-tabular' : ''} text-xl sm:text-2xl font-semibold leading-tight break-words line-clamp-2 ${toneClasses[tone]}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}
