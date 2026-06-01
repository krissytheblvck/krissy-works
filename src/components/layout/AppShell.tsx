'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlusCircle, Settings, Users, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { href: '/settings/prices', label: 'Prices', shortLabel: 'Prices', icon: Settings },
] as const

function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isProjectWorkspace = pathname.startsWith('/projects/') && pathname !== '/projects/new'

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <header className="bg-surface border-b border-border px-4 sm:px-6 py-3 shrink-0 z-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex md:hidden items-center justify-between gap-2">
            <Link href="/dashboard" className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-foreground leading-tight truncate">
                Brilliant Metal Works
              </h1>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle />
              <Link href="/projects/new">
                <Button size="sm">
                  <PlusCircle size={16} />
                  New
                </Button>
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-between gap-4">
            <Link href="/dashboard" className="shrink-0">
              <h1 className="text-lg font-bold text-foreground leading-tight">Brilliant Metal Works</h1>
              <p className="text-xs text-muted">Project Workflow System</p>
            </Link>

            <nav className="flex items-center gap-2">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = isNavActive(pathname, href)
                return (
                  <Link key={href} href={href}>
                    <Button
                      variant={active ? 'primary' : 'ghost'}
                      size="sm"
                      className={cn(!active && 'text-muted')}
                    >
                      <Icon size={16} />
                      {label}
                    </Button>
                  </Link>
                )
              })}
              <ThemeToggle />
              <Link href="/projects/new">
                <Button size="sm">
                  <PlusCircle size={16} />
                  New Project
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0',
          isProjectWorkspace && 'min-h-0'
        )}
      >
        {children}
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] transition-colors duration-300"
        aria-label="Main navigation"
      >
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {NAV_ITEMS.map(({ href, shortLabel, icon: Icon }) => {
            const active = isNavActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[3rem] px-1 rounded-lg text-[10px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                <span>{shortLabel}</span>
              </Link>
            )
          })}
          <Link
            href="/projects/new"
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[3rem] px-1 rounded-lg text-[10px] font-medium transition-colors',
              pathname === '/projects/new' ? 'text-foreground' : 'text-muted'
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 transition-colors">
              <PlusCircle size={18} />
            </span>
            <span>New</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
