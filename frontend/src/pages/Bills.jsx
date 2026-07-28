import React, { useState } from 'react'
import { Plus, Receipt, Trash2, Zap } from 'lucide-react'
import { useApp, formatCurrency } from '../context/AppContext.jsx'
import { Button, Field, inputClass, EmptyState, CategoryDot } from '../components/Bits.jsx'
import Modal from '../components/Modal.jsx'

function BillModal({ open, onClose }) {
  const { addBill, categories } = useApp()
  const [form, setForm] = useState({ name: '', category: categories.expense[0]?.id, amount: '', dueDay: '', autopay: false })

  const submit = (e) => {
    e.preventDefault()
    if (!form.name || !form.amount || !form.dueDay) return
    addBill({ ...form, amount: Number(form.amount), dueDay: Number(form.dueDay) })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Recurring Bill">
      <form onSubmit={submit}>
        <Field label="Bill name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Internet" />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categories.expense.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input type="number" min="0" className={inputClass} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Due day of month">
          <input type="number" min="1" max="31" className={inputClass} required value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} placeholder="1–31" />
        </Field>
        <label className="flex items-center gap-2 mb-6 text-sm text-ink/80">
          <input type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} className="rounded border-line" />
          Autopay enabled
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Bill</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Bills() {
  const { bills, categories, deleteBill } = useApp()
  const [open, setOpen] = useState(false)

  const today = new Date().getDate()
  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay)
  const totalMonthly = bills.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="ledger-card px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total Monthly Bills</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-ink">{formatCurrency(totalMonthly)}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Bill
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No recurring bills yet"
          hint="Add rent, internet, subscriptions, or loan payments so you never miss a due date."
          action={<Button onClick={() => setOpen(true)}><Plus size={16} /> Add Bill</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((b) => {
            const meta = categories.expense.find((c) => c.id === b.category)
            const status = b.dueDay < today ? 'past' : b.dueDay - today <= 5 ? 'soon' : 'later'
            return (
              <div key={b.id} className="ledger-card p-5 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryDot color={meta?.color} />
                    <p className="font-display text-lg">{b.name}</p>
                  </div>
                  <button onClick={() => deleteBill(b.id)} className="text-muted hover:text-brick p-1" aria-label="Delete bill">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="font-mono font-tabular text-xl font-semibold text-ink">{formatCurrency(b.amount)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      status === 'past'
                        ? 'bg-brick/10 text-brick'
                        : status === 'soon'
                        ? 'bg-gold/15 text-gold-dark'
                        : 'bg-pine/10 text-pine'
                    }`}
                  >
                    Due day {b.dueDay}
                  </span>
                  {b.autopay && (
                    <span className="flex items-center gap-1 text-muted">
                      <Zap size={12} /> Autopay
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BillModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
