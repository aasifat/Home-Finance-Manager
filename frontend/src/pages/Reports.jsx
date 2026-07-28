import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Download } from 'lucide-react'
import {
  useApp, currentMonthKey, monthTotals, categoryBreakdown, shiftMonthKey, monthLabel, formatCurrency, buildNarrative, topCategory,
} from '../context/AppContext.jsx'
import { Button, CategoryDot } from '../components/Bits.jsx'

export default function Reports() {
  const { transactions, categories, profile } = useApp()
  const [range, setRange] = useState(6)

  const months = useMemo(() => {
    const arr = []
    for (let i = range - 1; i >= 0; i--) arr.push(shiftMonthKey(currentMonthKey(), -i))
    return arr
  }, [range])

  const barData = months.map((k) => {
    const t = monthTotals(transactions, k)
    return { label: monthLabel(k).split(' ')[0].slice(0, 3), Income: t.income, Expenses: t.expense, Saved: t.balance }
  })

  const key = currentMonthKey()
  const breakdown = categoryBreakdown(transactions, key, 'expense')
  const pieData = Object.entries(breakdown).map(([id, amount]) => {
    const meta = categories.expense.find((c) => c.id === id)
    return { name: meta?.label || id, value: amount, color: meta?.color || '#68746D' }
  })

  const { income, expense, balance } = monthTotals(transactions, key)
  const savingsRate = income > 0 ? Math.round((balance / income) * 1000) / 10 : 0
  const top = topCategory(breakdown, categories.expense)
  const narrative = buildNarrative({ familyName: profile.familyName, income, expense, savedAmount: balance, savingsRate, topCat: top })

  const avgSavingsRate = useMemo(() => {
    const rates = months.map((k) => {
      const t = monthTotals(transactions, k)
      return t.income > 0 ? (t.balance / t.income) * 100 : 0
    })
    return Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10
  }, [months, transactions])

  const exportCsv = () => {
    const rows = [['Date', 'Type', 'Category', 'Amount', 'Note']]
    transactions
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((t) => {
        const meta = categories[t.type].find((c) => c.id === t.category)
        rows.push([new Date(t.date).toISOString().slice(0, 10), t.type, meta?.label || t.category, t.amount, (t.note || '').replace(/,/g, ' ')])
      })
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'financial-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[3, 6, 12].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                range === r ? 'bg-pine text-white border-pine' : 'border-line text-muted hover:bg-black/5'
              }`}
            >
              {r} months
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </Button>
      </div>

      <div className="ledger-card p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2">This Month's Story</p>
        <p className="font-display text-lg italic text-ink/90">"{narrative}"</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="ledger-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Avg. Savings Rate</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-pine">{avgSavingsRate}%</p>
          <p className="text-xs text-muted">over last {range} months</p>
        </div>
        <div className="ledger-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">This Month's Income</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-ink">{formatCurrency(income)}</p>
        </div>
        <div className="ledger-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">This Month's Expenses</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-ink">{formatCurrency(expense)}</p>
        </div>
      </div>

      <div className="ledger-card p-5">
        <p className="font-display text-base mb-4">Income vs Expenses vs Saved</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData}>
            <CartesianGrid stroke="#DBD9CE" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68746D' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#68746D' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Income" fill="#1F3D3A" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Expenses" fill="#B54834" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Saved" fill="#C9A227" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="ledger-card p-5">
        <p className="font-display text-base mb-4">This Month's Spending Mix</p>
        {pieData.length === 0 ? (
          <p className="text-sm text-muted">No expenses recorded this month.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-[240px] h-[240px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={90}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm flex-1 min-w-[160px]">
              {pieData
                .sort((a, b) => b.value - a.value)
                .map((d) => (
                  <li key={d.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
                    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                      <CategoryDot color={d.color} className="mt-1" />
                      <span className="break-words">{d.name}</span>
                    </span>
                    <span className="font-mono font-tabular text-muted whitespace-nowrap">
                      {formatCurrency(d.value)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
