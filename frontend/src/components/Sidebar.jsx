import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  PiggyBank,
  Landmark,
  Wallet,
  Receipt,
  BarChart3,
  CalendarDays,
  UserCircle,
  BookOpen,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/income', label: 'Income', icon: TrendingUp },
  { to: '/expenses', label: 'Expenses', icon: ShoppingBag },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/loans', label: 'Loans & Debts', icon: Landmark },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/profile', label: 'Profile', icon: UserCircle },
]

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside
      className={`fixed z-40 inset-y-0 left-0 w-64 bg-pine text-white flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-2 px-6 py-6 border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-pine-dark">
          <BookOpen size={18} strokeWidth={2.2} />
        </div>
        <div>
          <p className="font-display text-lg leading-tight tracking-tight">Ledger</p>
          <p className="text-[11px] text-white/60 tracking-wide uppercase">Home Finance</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-gold-light'
                  : 'text-white/75 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-[11px] text-white/45 leading-relaxed">
        Every entry, kept in order.
      </div>
    </aside>
  )
}
