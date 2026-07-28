import React, { useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function Layout({ title, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-paper text-ink">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
