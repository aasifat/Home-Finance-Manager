import React, { useState } from 'react'
import { Plus, Landmark, Trash2 } from 'lucide-react'
import { useApp, formatCurrency } from '../context/AppContext.jsx'
import { Button, ProgressBar, Field, inputClass, EmptyState } from '../components/Bits.jsx'
import Modal from '../components/Modal.jsx'

function LoanModal({ open, onClose }) {
  const { addLoan } = useApp()
  const [form, setForm] = useState({ name: '', lender: '', principal: '', remaining: '', interestRate: '', monthlyPayment: '', nextDueDate: '' })

  const submit = (e) => {
    e.preventDefault()
    if (!form.name || !form.principal) return
    addLoan({
      ...form,
      principal: Number(form.principal),
      remaining: Number(form.remaining || form.principal),
      interestRate: Number(form.interestRate || 0),
      monthlyPayment: Number(form.monthlyPayment || 0),
      nextDueDate: form.nextDueDate ? new Date(form.nextDueDate).toISOString() : new Date().toISOString(),
      startDate: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Loan / Debt" wide>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Loan name">
          <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Car Loan" />
        </Field>
        <Field label="Lender">
          <input className={inputClass} value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} placeholder="e.g. City Bank" />
        </Field>
        <Field label="Principal amount">
          <input type="number" min="0" className={inputClass} required value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Remaining balance">
          <input type="number" min="0" className={inputClass} value={form.remaining} onChange={(e) => setForm({ ...form, remaining: e.target.value })} placeholder="Defaults to principal" />
        </Field>
        <Field label="Interest rate (%)">
          <input type="number" min="0" step="0.1" className={inputClass} value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="0.0" />
        </Field>
        <Field label="Monthly payment">
          <input type="number" min="0" className={inputClass} value={form.monthlyPayment} onChange={(e) => setForm({ ...form, monthlyPayment: e.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Next due date">
          <input type="date" className={inputClass} value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Loan</Button>
        </div>
      </form>
    </Modal>
  )
}

function PaymentModal({ open, onClose, loan }) {
  const { recordLoanPayment } = useApp()
  const [amount, setAmount] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!amount || !loan) return
    recordLoanPayment(loan.id, Number(amount))
    setAmount('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={loan ? `Record Payment — ${loan.name}` : 'Record Payment'}>
      <form onSubmit={submit}>
        <Field label="Payment amount">
          <input type="number" min="1" className={inputClass} required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={loan ? String(loan.monthlyPayment) : '0.00'} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Record</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function LoansDebts() {
  const { loans, deleteLoan } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const [payLoan, setPayLoan] = useState(null)

  const totalRemaining = loans.reduce((s, l) => s + l.remaining, 0)
  const totalMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0)

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="ledger-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total Outstanding</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-brick">{formatCurrency(totalRemaining)}</p>
        </div>
        <div className="ledger-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Monthly Obligation</p>
          <p className="font-mono font-tabular text-2xl font-semibold text-ink">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Add Loan
        </Button>
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans or debts tracked"
          hint="Add a loan to keep tabs on balances and due dates."
          action={<Button onClick={() => setAddOpen(true)}><Plus size={16} /> Add Loan</Button>}
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {loans.map((l) => {
            const paidPct = l.principal > 0 ? Math.round(((l.principal - l.remaining) / l.principal) * 100) : 0
            return (
              <div key={l.id} className="ledger-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg">{l.name}</p>
                    <p className="text-xs text-muted">{l.lender} · {l.interestRate}% APR</p>
                  </div>
                  <button onClick={() => deleteLoan(l.id)} className="text-muted hover:text-brick p-1" aria-label="Delete loan">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="font-mono font-tabular text-xl font-semibold text-ink">
                  {formatCurrency(l.remaining)}
                  <span className="text-sm text-muted font-normal"> remaining of {formatCurrency(l.principal)}</span>
                </p>
                <ProgressBar value={l.principal - l.remaining} max={l.principal} color="#1F3D3A" />
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{paidPct}% paid off</span>
                  <span>Next due {new Date(l.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-ink/80">Monthly: <span className="font-mono font-tabular">{formatCurrency(l.monthlyPayment)}</span></span>
                  {l.remaining > 0 && (
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setPayLoan(l)}>
                      Record payment
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <LoanModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PaymentModal open={!!payLoan} onClose={() => setPayLoan(null)} loan={payLoan} />
    </div>
  )
}
