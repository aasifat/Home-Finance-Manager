import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useApp, formatCurrency } from '../context/AppContext.jsx'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import { Field, inputClass, Button } from '../components/Bits.jsx'

const TYPE_META = {
  income: { label: 'Income', color: '#1F3D3A' },
  expense: { label: 'Expense', color: '#B54834' },
  bill: { label: 'Bill', color: '#9A7B18' },
  loan: { label: 'Loan Due', color: '#8C3423' },
  savings: { label: 'Savings', color: '#C9A227' },
  other: { label: 'Event', color: '#68746D' },
}

function buildCells(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function monthKeyFor(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function AddEventModal({ open, onClose, defaultDate, onCreated }) {
  const [form, setForm] = useState({ title: '', type: 'other', amount: '', date: defaultDate, notes: '', repeat: 'none' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setForm({ title: '', type: 'other', amount: '', date: defaultDate, notes: '', repeat: 'none' })
  }, [open, defaultDate])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    setError('')
    try {
      const created = await api.post('/calendar/events', {
        ...form,
        amount: form.amount ? Number(form.amount) : 0,
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Event">
      <form onSubmit={submit}>
        <Field label="Title">
          <input
            className={inputClass}
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Property tax payment"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="other">General event</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
          <Field label="Amount (optional)">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>
        </div>
        <Field label="Date">
          <input
            type="date"
            required
            className={inputClass}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Repeat">
          <select className={inputClass} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            className={inputClass}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
          />
        </Field>
        {error && <p className="text-xs text-brick mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add Event'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CalendarPage() {
  const { transactions, bills, loans, categories } = useApp()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [filters, setFilters] = useState(new Set(Object.keys(TYPE_META)))
  const [selectedDay, setSelectedDay] = useState(null)
  const [manualEvents, setManualEvents] = useState([])
  const [modalOpen, setModalOpen] = useState(false)

  const cells = useMemo(() => buildCells(year, month), [year, month])

  useEffect(() => {
    let cancelled = false
    api
      .get(`/calendar/events?month=${monthKeyFor(year, month)}`)
      .then((data) => !cancelled && setManualEvents(data || []))
      .catch(() => !cancelled && setManualEvents([]))
    return () => {
      cancelled = true
    }
  }, [year, month])

  const eventsByDay = useMemo(() => {
    const map = {}
    const push = (day, ev) => {
      if (!map[day]) map[day] = []
      map[day].push(ev)
    }

    transactions.forEach((t) => {
      const d = new Date(t.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const meta = categories[t.type].find((c) => c.id === t.category)
        push(d.getDate(), { type: t.type, title: t.note || meta?.label || t.type, amount: t.amount })
      }
    })

    bills.forEach((b) => {
      if (b.dueDay <= new Date(year, month + 1, 0).getDate()) {
        push(b.dueDay, { type: 'bill', title: b.name, amount: b.amount })
      }
    })

    loans.forEach((l) => {
      const d = new Date(l.nextDueDate)
      if (d.getFullYear() === year && d.getMonth() === month) {
        push(d.getDate(), { type: 'loan', title: `${l.name} payment`, amount: l.monthlyPayment })
      }
    })

    manualEvents.forEach((e) => {
      const d = new Date(e.date)
      push(d.getDate(), { type: e.type || 'other', title: e.title, amount: e.amount, id: e.id, source: 'manual', notes: e.notes })
    })

    return map
  }, [transactions, bills, loans, categories, manualEvents, year, month])

  const goMonth = (delta) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setMonth(m)
    setYear(y)
    setSelectedDay(null)
  }

  const toggleFilter = (key) => {
    setFilters((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const deleteManualEvent = async (id) => {
    await api.del(`/calendar/events/${id}`)
    setManualEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const isToday = (day) => day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate()
  const dayEvents = (day) => (eventsByDay[day] || []).filter((e) => filters.has(e.type))

  const defaultDateForModal = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => goMonth(-1)} className="p-1.5 rounded-md border border-line hover:bg-black/5" aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <p className="font-display text-lg w-44 text-center">
            {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <button onClick={() => goMonth(1)} className="p-1.5 rounded-md border border-line hover:bg-black/5" aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.has(key) ? 'border-transparent text-white' : 'border-line text-muted bg-white'
              }`}
              style={filters.has(key) ? { backgroundColor: meta.color } : {}}
            >
              {meta.label}
            </button>
          ))}
          <Button onClick={() => setModalOpen(true)} className="ml-1">
            <Plus size={15} /> Add Event
          </Button>
        </div>
      </div>

      <div className="ledger-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {weekdayLabels.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[11px] uppercase tracking-wide text-muted font-medium">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const evs = day ? dayEvents(day) : []
            return (
              <button
                key={i}
                disabled={!day}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[86px] border-b border-r border-line last:border-r-0 p-1.5 text-left align-top flex flex-col gap-1 ${
                  !day ? 'bg-paper/40' : 'hover:bg-paper/60'
                } ${selectedDay === day ? 'ring-2 ring-inset ring-gold' : ''}`}
              >
                {day && (
                  <span
                    className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-pine text-white' : 'text-ink/70'
                    }`}
                  >
                    {day}
                  </span>
                )}
                <div className="flex flex-col gap-0.5">
                  {evs.slice(0, 3).map((e, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: TYPE_META[e.type]?.color || TYPE_META.other.color }}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                  ))}
                  {evs.length > 3 && <span className="text-[10px] text-muted">+{evs.length - 3} more</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base">
              {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => setModalOpen(true)}>
              <Plus size={13} /> Add Event
            </Button>
          </div>
          {dayEvents(selectedDay).length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled on this day.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dayEvents(selectedDay).map((e, idx) => (
                <li key={idx} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_META[e.type]?.color }} />
                    {e.title}
                    <span className="text-xs text-muted">({TYPE_META[e.type]?.label})</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {e.amount > 0 && <span className="font-mono font-tabular font-medium">{formatCurrency(e.amount)}</span>}
                    {e.source === 'manual' && (
                      <button onClick={() => deleteManualEvent(e.id)} className="text-muted hover:text-brick p-1" aria-label="Delete event">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AddEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDate={defaultDateForModal}
        onCreated={(created) => setManualEvents((prev) => [...prev, created])}
      />
    </div>
  )
}
