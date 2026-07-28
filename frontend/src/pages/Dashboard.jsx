import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, PiggyBank, Inbox } from 'lucide-react'
import { useApp, currentMonthKey, monthTotals, categoryBreakdown, topCategory, formatCurrency, monthLabel, shiftMonthKey, buildNarrative, txForMonth } from '../context/AppContext.jsx'
import StatCard from '../components/StatCard.jsx'
import { CategoryDot, EmptyState } from '../components/Bits.jsx'

export default function Dashboard() {
  const { transactions, categories, bills, profile } = useApp()
  const [key, setKey] = useState(currentMonthKey())

  const { income, expense, balance } = monthTotals(transactions, key)
  const breakdown = categoryBreakdown(transactions, key, 'expense')
  const top = topCategory(breakdown, categories.expense)
  const savingsRate = income > 0 ? Math.round((balance / income) * 1000) / 10 : 0

  const pieData = Object.entries(breakdown).map(([id, amount]) => {
    const meta = categories.expense.find((c) => c.id === id)
    return { name: meta?.label || id, value: amount, color: meta?.color || '#68746D' }
  })

  const trend = useMemo(() => {
    const points = []
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonthKey(currentMonthKey(), -i)
      const t = monthTotals(transactions, k)
      points.push({ label: monthLabel(k).split(' ')[0].slice(0, 3), income: t.income, expense: t.expense })
    }
    return points
  }, [transactions])

  const narrative = buildNarrative({
    familyName: profile.familyName,
    income,
    expense,
    savedAmount: balance,
    savingsRate,
    topCat: top,
  })

  const upcomingBills = bills.slice(0, 4)
  const recentTx = txForMonth(transactions, key).slice(0, 6)

  const isCurrentMonth = key === currentMonthKey()

  return (
    <div className="space-y-6">
      {/* Month switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setKey(shiftMonthKey(key, -1))}
          className="p-1.5 rounded-md border border-line hover:bg-black/5"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="font-medium text-sm text-ink w-40 text-center">{monthLabel(key)}</p>
        <button
          onClick={() => setKey(shiftMonthKey(key, 1))}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-md border border-line hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Signature monthly statement card */}
      <div className="relative receipt-edge">
        <div className="ledger-card !border-pine/20 !bg-pine text-white px-6 sm:px-10 py-8 sm:py-10 rounded-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <div
              className={`stamp shrink-0 w-24 h-24 flex flex-col items-center justify-center ${
                balance >= 0 ? 'text-gold-light' : 'text-brick-light'
              }`}
            >
              <span className="font-display text-2xl leading-none">
                {income > 0 ? `${savingsRate}%` : '—'}
              </span>
              <span className="text-[9px] uppercase tracking-wider mt-1">
                {balance >= 0 ? 'Saved' : 'Over'}
              </span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">
                Where did our money go? — {monthLabel(key)}
              </p>
              <p className="font-display text-xl sm:text-2xl leading-snug italic text-gold-dark">
                "{narrative}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Income" value={formatCurrency(income)} icon={TrendingUp} tone="positive" />
        <StatCard label="Total Expenses" value={formatCurrency(expense)} icon={TrendingDown} tone="negative" />
        <StatCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={Wallet}
          tone={balance >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Highest Category"
          value={top ? top.label : '—'}
          sub={top ? formatCurrency(top.amount) : 'No expenses yet'}
          icon={PiggyBank}
          tone="gold"
          mono={false}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Category pie */}
        <div className="lg:col-span-2 ledger-card p-5">
          <p className="font-display text-base mb-4">Expenses by Category</p>
          {pieData.length === 0 ? (
            <EmptyState icon={Inbox} title="No expenses yet" hint="Add an expense to see the breakdown." />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={54} paddingAngle={2}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-sm flex-1 min-w-[140px]">
                {pieData
                  .sort((a, b) => b.value - a.value)
                  .map((d) => (
                    <li key={d.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
                      <span className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-ink/80">
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

        {/* Income vs expense trend */}
        <div className="lg:col-span-3 ledger-card p-5">
          <p className="font-display text-base mb-4">6-Month Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ left: -20 }}>
              <CartesianGrid stroke="#DBD9CE" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68746D' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#68746D' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Line type="monotone" dataKey="income" stroke="#1F3D3A" strokeWidth={2.5} dot={false} name="Income" />
              <Line type="monotone" dataKey="expense" stroke="#B54834" strokeWidth={2.5} dot={false} name="Expense" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="ledger-card p-5">
          <p className="font-display text-base mb-4">Recent Transactions</p>
          {recentTx.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet this month.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentTx.map((t) => {
                const meta = categories[t.type].find((c) => c.id === t.category)
                return (
                  <li key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <CategoryDot color={meta?.color} />
                      <div>
                        <p className="text-sm text-ink">{t.note || meta?.label}</p>
                        <p className="text-xs text-muted">
                          {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono font-tabular text-sm font-medium ${
                        t.type === 'income' ? 'text-pine' : 'text-brick'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '−'}
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Upcoming bills */}
        <div className="ledger-card p-5">
          <p className="font-display text-base mb-4">Upcoming Bills</p>
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-muted">No bills configured yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingBills.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm text-ink">{b.name}</p>
                    <p className="text-xs text-muted">Due day {b.dueDay}</p>
                  </div>
                  <span className="font-mono font-tabular text-sm font-medium text-ink">
                    {formatCurrency(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
