import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const AppContext = createContext(null)

const EMPTY_CATEGORIES = { income: [], expense: [] }

export function AppProvider({ children }) {
  const [family, setFamily] = useState({ familyName: '', email: '', currency: 'USD' })
  const [members, setMembers] = useState([])
  const [notifications, setNotifications] = useState({
    monthlyReminder: true,
    weeklySummary: true,
    billReminders: true,
    spendingAlerts: true,
    reminderThreshold: 80,
  })
  const [transactions, setTransactions] = useState([])
  const [savings, setSavings] = useState({ goals: [], contributions: [] })
  const [loans, setLoans] = useState([])
  const [budget, setBudgetState] = useState({})
  const [bills, setBills] = useState([])
  const [categories, setCategories] = useState(EMPTY_CATEGORIES)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [familyRes, membersRes, notifRes, txRes, savingsRes, loansRes, budgetRes, billsRes, catRes, alertsRes] =
        await Promise.all([
          api.get('/family'),
          api.get('/members'),
          api.get('/notifications'),
          api.get('/transactions'),
          api.get('/savings'),
          api.get('/loans'),
          api.get('/budget'),
          api.get('/bills'),
          api.get('/categories'),
          api.get('/notifications/alerts'),
        ])
      setFamily(familyRes)
      setMembers(membersRes || [])
      setNotifications(notifRes)
      setTransactions(txRes || [])
      setSavings(savingsRes || { goals: [], contributions: [] })
      setLoans(loansRes || [])
      setBudgetState(budgetRes || {})
      setBills(billsRes || [])
      setCategories(catRes || EMPTY_CATEGORIES)
      setAlerts(alertsRes || [])
    } catch (e) {
      setError(e.message || 'Could not reach the Ledger API. Is the Go backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadAlerts = useCallback(async () => {
    try {
      setAlerts((await api.get('/notifications/alerts')) || [])
    } catch {
      // leave the previous alerts in place
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ---- Transaction actions ----
  const addTransaction = async (tx) => {
    const created = await api.post('/transactions', tx)
    setTransactions((prev) => [created, ...prev])
    reloadAlerts()
  }
  const updateTransaction = async (id, patch) => {
    const updated = await api.put(`/transactions/${id}`, patch)
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
    reloadAlerts()
  }
  const deleteTransaction = async (id) => {
    await api.del(`/transactions/${id}`)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    reloadAlerts()
  }

  // ---- Savings actions ----
  const addSavingsGoal = async (goal) => {
    const created = await api.post('/savings/goals', goal)
    setSavings((s) => ({ ...s, goals: [...s.goals, created] }))
  }
  const contributeSavings = async (goalId, amount) => {
    const payload = await api.post(`/savings/goals/${goalId}/contribute`, { amount })
    setSavings(payload)
  }
  const deleteSavingsGoal = async (goalId) => {
    await api.del(`/savings/goals/${goalId}`)
    setSavings((s) => ({
      goals: s.goals.filter((g) => g.id !== goalId),
      contributions: s.contributions.filter((c) => c.goalId !== goalId),
    }))
  }

  // ---- Loan actions ----
  const addLoan = async (loan) => {
    const created = await api.post('/loans', loan)
    setLoans((prev) => [...prev, created])
  }
  const recordLoanPayment = async (id, amount) => {
    const updated = await api.post(`/loans/${id}/payment`, { amount })
    setLoans(updated)
  }
  const deleteLoan = async (id) => {
    await api.del(`/loans/${id}`)
    setLoans((prev) => prev.filter((l) => l.id !== id))
  }

  // ---- Budget actions ----
  const setBudget = async (categoryId, amount) => {
    const updated = await api.put('/budget', { category: categoryId, amount })
    setBudgetState(updated)
    reloadAlerts()
  }

  // ---- Bill actions ----
  const addBill = async (bill) => {
    const created = await api.post('/bills', bill)
    setBills((prev) => [...prev, created])
    reloadAlerts()
  }
  const updateBill = async (id, patch) => {
    const updated = await api.put(`/bills/${id}`, patch)
    setBills((prev) => prev.map((b) => (b.id === id ? updated : b)))
    reloadAlerts()
  }
  const deleteBill = async (id) => {
    await api.del(`/bills/${id}`)
    setBills((prev) => prev.filter((b) => b.id !== id))
    reloadAlerts()
  }

  // ---- Family / profile actions ----
  const updateProfile = async (patch) => {
    const updated = await api.put('/family', { ...family, ...patch })
    setFamily(updated)
  }
  const updateNotifications = async (patch) => {
    const updated = await api.put('/notifications', { ...notifications, ...patch })
    setNotifications(updated)
    reloadAlerts()
  }

  // ---- Family member actions (adding one sends an invitation email) ----
  const addMember = async ({ name, email, role }) => {
    const created = await api.post('/members', { name, email, role: role || 'Member' })
    setMembers((prev) => [...prev, created])
    reloadAlerts()
    return created
  }
  const resendInvite = async (id) => {
    await api.post(`/members/${id}/invite`)
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, invitationStatus: 'sent' } : m)))
    reloadAlerts()
  }
  const removeMember = async (id) => {
    await api.del(`/members/${id}`)
    setMembers((prev) => prev.filter((m) => m.id !== id))
    reloadAlerts()
  }

  // `profile` mirrors the shape pages already expect (family + members +
  // notification settings combined), so most pages didn't need to change.
  const profile = useMemo(
    () => ({ ...family, members, notifications }),
    [family, members, notifications]
  )

  const value = useMemo(
    () => ({
      transactions,
      savings,
      loans,
      budget,
      bills,
      categories,
      alerts,
      reloadAlerts,
      profile,
      loading,
      error,
      reload: loadAll,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addSavingsGoal,
      contributeSavings,
      deleteSavingsGoal,
      addLoan,
      recordLoanPayment,
      deleteLoan,
      setBudget,
      addBill,
      updateBill,
      deleteBill,
      updateProfile,
      updateNotifications,
      addMember,
      resendInvite,
      removeMember,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, savings, loans, budget, bills, categories, alerts, profile, loading, error]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ---------- Derived selectors (pure helpers, take state as input) ----------
// Unchanged from the demo — every page still filters/aggregates the full
// transaction list client-side, so these work identically against
// API-sourced data.

export function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function txForMonth(transactions, key) {
  return transactions.filter((t) => monthKey(t.date) === key)
}

export function monthTotals(transactions, key) {
  const tx = txForMonth(transactions, key)
  const income = tx.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = tx.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  return { income, expense, balance: income - expense }
}

export function categoryBreakdown(transactions, key, type = 'expense') {
  const tx = txForMonth(transactions, key).filter((t) => t.type === type)
  const map = {}
  tx.forEach((t) => {
    map[t.category] = (map[t.category] || 0) + t.amount
  })
  return map
}

export function topCategory(breakdown, categoryList) {
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  const [id, amount] = entries[0]
  const meta = categoryList.find((c) => c.id === id)
  return { id, amount, label: meta?.label || id, color: meta?.color || '#68746D' }
}

export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function shiftMonthKey(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m + delta, 1)
  return `${d.getFullYear()}-${d.getMonth()}`
}

// Builds the "Where did our money go?" narrative summary
export function buildNarrative({ familyName, income, expense, savedAmount, savingsRate, topCat }) {
  const name = familyName || 'Your family'
  if (income === 0 && expense === 0) {
    return `No transactions recorded yet this month. Add your income and expenses to see your monthly story.`
  }
  const savingsLine =
    savedAmount >= 0
      ? `${name} saved ${formatCurrency(savedAmount)}, which is ${savingsRate}% of total income.`
      : `${name} spent ${formatCurrency(Math.abs(savedAmount))} more than they earned this month.`
  const topCatLine = topCat ? ` ${topCat.label} was your highest expense category at ${formatCurrency(topCat.amount)}.` : ''
  return `${name} earned ${formatCurrency(income)} this month and spent ${formatCurrency(expense)}.${topCatLine} ${savingsLine}`
}
