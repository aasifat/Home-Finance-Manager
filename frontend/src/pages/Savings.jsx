import React, { useState } from 'react'
import { Plus, PiggyBank, Trash2 } from 'lucide-react'
import { useApp, formatCurrency } from '../context/AppContext.jsx'
import { Button, ProgressBar, Field, inputClass, EmptyState } from '../components/Bits.jsx'
import Modal from '../components/Modal.jsx'

function AddGoalModal({ open, onClose }) {
  const { addSavingsGoal } = useApp()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!name || !target) return
    addSavingsGoal({ name, target: Number(target), color: '#1F3D3A' })
    setName('')
    setTarget('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Savings Goal">
      <form onSubmit={submit}>
        <Field label="Goal name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Car" required />
        </Field>
        <Field label="Target amount">
          <input
            type="number"
            min="1"
            className={inputClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Goal</Button>
        </div>
      </form>
    </Modal>
  )
}

function ContributeModal({ open, onClose, goal }) {
  const { contributeSavings } = useApp()
  const [amount, setAmount] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0 || !goal) return
    contributeSavings(goal.id, Number(amount))
    setAmount('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={goal ? `Add to ${goal.name}` : 'Add Savings'}>
      <form onSubmit={submit}>
        <Field label="Amount">
          <input
            type="number"
            min="1"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Contribute</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Savings() {
  const { savings, deleteSavingsGoal } = useApp()
  const [goalModal, setGoalModal] = useState(false)
  const [contributeGoal, setContributeGoal] = useState(null)

  const totalSaved = savings.goals.reduce((s, g) => s + g.saved, 0)
  const totalTarget = savings.goals.reduce((s, g) => s + g.target, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="ledger-card px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold-dark">
            <PiggyBank size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Total Saved</p>
            <p className="font-mono font-tabular text-xl font-semibold text-pine">
              {formatCurrency(totalSaved)}
              <span className="text-sm text-muted font-normal"> / {formatCurrency(totalTarget)}</span>
            </p>
          </div>
        </div>
        <Button onClick={() => setGoalModal(true)}>
          <Plus size={16} /> New Goal
        </Button>
      </div>

      {savings.goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings goals yet"
          hint="Create a goal like an emergency fund or vacation to start tracking progress."
          action={<Button onClick={() => setGoalModal(true)}><Plus size={16} /> New Goal</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savings.goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
            const complete = g.saved >= g.target
            return (
              <div key={g.id} className="ledger-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <p className="font-display text-lg">{g.name}</p>
                  <button
                    onClick={() => deleteSavingsGoal(g.id)}
                    className="text-muted hover:text-brick p-1 -mr-1"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="font-mono font-tabular text-sm text-ink">
                  {formatCurrency(g.saved)} <span className="text-muted">of {formatCurrency(g.target)}</span>
                </p>
                <ProgressBar value={g.saved} max={g.target} color={complete ? '#C9A227' : g.color} />
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${complete ? 'text-gold-dark' : 'text-muted'}`}>
                    {complete ? 'Goal reached 🎉' : `${pct}% complete`}
                  </span>
                  {!complete && (
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setContributeGoal(g)}>
                      Add funds
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {savings.contributions.length > 0 && (
        <div className="ledger-card p-5">
          <p className="font-display text-base mb-3">Recent Contributions</p>
          <ul className="divide-y divide-line">
            {savings.contributions.slice(0, 8).map((c) => {
              const goal = savings.goals.find((g) => g.id === c.goalId)
              return (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink/80">{goal ? goal.name : 'Deleted goal'}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted text-xs">
                      {new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-mono font-tabular text-pine font-medium">+{formatCurrency(c.amount)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <AddGoalModal open={goalModal} onClose={() => setGoalModal(false)} />
      <ContributeModal open={!!contributeGoal} onClose={() => setContributeGoal(null)} goal={contributeGoal} />
    </div>
  )
}
