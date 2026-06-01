'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlusCircle, Settings, Users, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings/prices', label: 'Prices', icon: Settings },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isProjectWorkspace = pathname.startsWith('/projects/') && pathname !== '/projects/new'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/dashboard" className="shrink-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Brilliant Metal Works</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Project Workflow System</p>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}>
                  <Button
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                    className={cn(!active && 'text-gray-600')}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{label}</span>
                  </Button>
                </Link>
              )
            })}
            <Link href="/projects/new">
              <Button size="sm">
                <PlusCircle size={16} />
                <span className="hidden sm:inline">New Project</span>
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className={cn('flex-1', isProjectWorkspace && 'min-h-0')}>{children}</div>
    </div>
  )
}
