import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RefreshCw, WifiOff } from 'lucide-react'
import Layout from './components/Layout.jsx'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Income from './pages/Income.jsx'
import Expenses from './pages/Expenses.jsx'
import Savings from './pages/Savings.jsx'
import LoansDebts from './pages/LoansDebts.jsx'
import Budget from './pages/Budget.jsx'
import Bills from './pages/Bills.jsx'
import Reports from './pages/Reports.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import Profile from './pages/Profile.jsx'

const TITLES = {
  '/': 'Dashboard',
  '/income': 'Income',
  '/expenses': 'Expenses',
  '/savings': 'Savings',
  '/loans': 'Loans & Debts',
  '/budget': 'Monthly Budget',
  '/bills': 'Upcoming Bills',
  '/reports': 'Financial Reports',
  '/calendar': 'Calendar',
  '/profile': 'Profile',
}

function withLayout(title, Component) {
  return (
    <Layout title={title}>
      <Component />
    </Layout>
  )
}

export default function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink">
        <RefreshCw size={22} className="animate-spin text-pine" />
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <AppProvider>
      <Ledger />
    </AppProvider>
  )
}

function Ledger() {
  const { loading, error, reload } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={22} className="animate-spin text-pine" />
          <p className="text-sm text-muted">Loading your household's finances…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink px-6">
        <div className="ledger-card max-w-md p-8 flex flex-col items-center text-center gap-3">
          <WifiOff size={24} className="text-brick" />
          <p className="font-display text-lg">Can't reach the Ledger API</p>
          <p className="text-sm text-muted">{error}</p>
          <p className="text-xs text-muted">
            Make sure the Go backend is running (see the backend README) and that{' '}
            <code className="bg-paper px-1 rounded">VITE_API_URL</code> points to it.
          </p>
          <button
            onClick={reload}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-pine text-white hover:bg-pine-light"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/" element={withLayout(TITLES['/'], Dashboard)} />
      <Route path="/income" element={withLayout(TITLES['/income'], Income)} />
      <Route path="/expenses" element={withLayout(TITLES['/expenses'], Expenses)} />
      <Route path="/savings" element={withLayout(TITLES['/savings'], Savings)} />
      <Route path="/loans" element={withLayout(TITLES['/loans'], LoansDebts)} />
      <Route path="/budget" element={withLayout(TITLES['/budget'], Budget)} />
      <Route path="/bills" element={withLayout(TITLES['/bills'], Bills)} />
      <Route path="/reports" element={withLayout(TITLES['/reports'], Reports)} />
      <Route path="/calendar" element={withLayout(TITLES['/calendar'], CalendarPage)} />
      <Route path="/profile" element={withLayout(TITLES['/profile'], Profile)} />
    </Routes>
  )
}
