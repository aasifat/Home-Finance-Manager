import React, { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Field, inputClass, Button } from './Bits.jsx'
import { useApp } from '../context/AppContext.jsx'

const empty = (type, categories) => ({
  type,
  category: categories[0]?.id || '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
  recurring: false,
})

export default function TransactionModal({ open, onClose, type, editing }) {
  const { categories, addTransaction, updateTransaction } = useApp()
  const catList = categories[type]
  const [form, setForm] = useState(empty(type, catList))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setForm({ ...editing, date: editing.date.slice(0, 10) })
    } else {
      setForm(empty(type, catList))
    }
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    const payload = { ...form, amount: Number(form.amount), date: form.date }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateTransaction(editing.id, payload)
      } else {
        await addTransaction(payload)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${type}` : `Add ${type === 'income' ? 'Income' : 'Expense'}`}>
      <form onSubmit={submit}>
        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className={inputClass}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </Field>
        <Field label="Category">
          <select
            className={inputClass}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {catList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            required
            className={inputClass}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Note">
          <input
            type="text"
            className={inputClass}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Optional description"
          />
        </Field>
        <label className="flex items-center gap-2 mb-6 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            className="rounded border-line"
          />
          This repeats monthly
        </label>
        {error && <p className="text-xs text-brick mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}
