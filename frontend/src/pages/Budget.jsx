import React, { useState } from 'react'
import { useApp, currentMonthKey, categoryBreakdown, formatCurrency } from '../context/AppContext.jsx'
import { ProgressBar, CategoryDot } from '../components/Bits.jsx'
import { AlertTriangle } from 'lucide-react'

export default function Budget() {
  const { transactions, categories, budget, setBudget } = useApp()
  const key = currentMonthKey()
  const spend = categoryBreakdown(transactions, key, 'expense')

  const totalBudget = Object.values(budget).reduce((s, v) => s + Number(v || 0), 0)
  const totalSpend = Object.values(spend).reduce((s, v) => s + v, 0)

  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')

  const startEdit = (id, current) => {
    setEditing(id)
    setDraft(String(current))
  }
  const commit = (id) => {
    const value = Number(draft)
    if (!Number.isNaN(value) && value >= 0) setBudget(id, value)
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <div className="ledger-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Total Monthly Budget</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-ink">{formatCurrency(totalBudget)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Spent So Far</p>
          <p className={`font-mono font-tabular text-2xl font-semibold ${totalSpend > totalBudget ? 'text-brick' : 'text-pine'}`}>
            {formatCurrency(totalSpend)}
          </p>
        </div>
        <div className="flex-1 min-w-[160px]">
          <ProgressBar value={totalSpend} max={totalBudget} color={totalSpend > totalBudget ? '#B54834' : '#1F3D3A'} />
        </div>
      </div>

      <div className="ledger-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 font-medium text-right">Spent</th>
              <th className="px-5 py-3 font-medium text-right">Budget</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {categories.expense.map((c) => {
              const spent = spend[c.id] || 0
              const limit = Number(budget[c.id] || 0)
              const over = limit > 0 && spent > limit
              return (
                <tr key={c.id} className="hover:bg-paper/60">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <CategoryDot color={c.color} />
                      {c.label}
                      {over && <AlertTriangle size={13} className="text-brick" />}
                    </span>
                  </td>
                  <td className="px-5 py-3 w-48">
                    <ProgressBar value={spent} max={limit || 1} color={over ? '#B54834' : c.color} />
                  </td>
                  <td className={`px-5 py-3 text-right font-mono font-tabular ${over ? 'text-brick font-semibold' : 'text-ink'}`}>
                    {formatCurrency(spent)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editing === c.id ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        className="w-24 rounded-md border border-line px-2 py-1 text-right font-mono text-sm"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(c.id)}
                        onKeyDown={(e) => e.key === 'Enter' && commit(c.id)}
                      />
                    ) : (
                      <button
                        className="font-mono font-tabular text-muted hover:text-ink underline decoration-dotted underline-offset-4"
                        onClick={() => startEdit(c.id, limit)}
                      >
                        {formatCurrency(limit)}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Click any budget amount to edit it.</p>
    </div>
  )
}
