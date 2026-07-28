import React from 'react'

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="ledger-card p-10 flex flex-col items-center text-center gap-2">
      {Icon && (
        <div className="w-11 h-11 rounded-full bg-paper flex items-center justify-center text-muted mb-1">
          <Icon size={20} />
        </div>
      )}
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="text-sm text-muted max-w-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function CategoryDot({ color, className = '' }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}

export function ProgressBar({ value, max, color = '#1F3D3A', trackClass = 'bg-line' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={`w-full h-2 rounded-full ${trackClass} overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-pine text-white hover:bg-pine-light',
    secondary: 'bg-paper text-ink border border-line hover:bg-line/40',
    danger: 'bg-brick text-white hover:bg-brick-dark',
    ghost: 'text-pine hover:bg-pine/5',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
