import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Repeat, Inbox } from 'lucide-react'
import { useApp, currentMonthKey, monthLabel, shiftMonthKey, txForMonth, formatCurrency } from '../context/AppContext.jsx'
import { Button, CategoryDot, EmptyState } from './Bits.jsx'
import TransactionModal from './TransactionModal.jsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function TransactionListPage({ type }) {
  const { transactions, categories, deleteTransaction } = useApp()
  const [key, setKey] = useState(currentMonthKey())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterCategory, setFilterCategory] = useState('all')

  const catList = categories[type]
  const isCurrentMonth = key === currentMonthKey()

  const monthTx = useMemo(
    () =>
      txForMonth(transactions, key)
        .filter((t) => t.type === type)
        .filter((t) => filterCategory === 'all' || t.category === filterCategory)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, key, type, filterCategory]
  )

  const total = monthTx.reduce((sum, t) => sum + t.amount, 0)

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (t) => {
    setEditing(t)
    setModalOpen(true)
  }

  const label = type === 'income' ? 'Income' : 'Expense'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setKey(shiftMonthKey(key, -1))}
            className="p-1.5 rounded-md border border-line hover:bg-black/5"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="font-medium text-sm w-36 text-center">{monthLabel(key)}</p>
          <button
            onClick={() => setKey(shiftMonthKey(key, 1))}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-md border border-line hover:bg-black/5 disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add {label}
        </Button>
      </div>

      <div className="ledger-card p-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Total {label}</p>
          <p className={`font-mono font-tabular text-2xl font-semibold ${type === 'income' ? 'text-pine' : 'text-brick'}`}>
            {formatCurrency(total)}
          </p>
        </div>
        <select
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {catList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {monthTx.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`No ${label.toLowerCase()} recorded`}
          hint={`Add your first ${label.toLowerCase()} entry for ${monthLabel(key)}.`}
          action={<Button onClick={openAdd}><Plus size={16} /> Add {label}</Button>}
        />
      ) : (
        <div className="ledger-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {monthTx.map((t) => {
                const meta = catList.find((c) => c.id === t.category)
                return (
                  <tr key={t.id} className="hover:bg-paper/60">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <CategoryDot color={meta?.color} />
                        {meta?.label || t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink/80">
                      <span className="flex items-center gap-1.5">
                        {t.note || '—'}
                        {t.recurring && <Repeat size={13} className="text-gold-dark" />}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono font-tabular font-medium ${
                        type === 'income' ? 'text-pine' : 'text-brick'
                      }`}
                    >
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-md hover:bg-black/5 text-muted"
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteTransaction(t.id)}
                          className="p-1.5 rounded-md hover:bg-black/5 text-brick"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} type={type} editing={editing} />
    </div>
  )
}
