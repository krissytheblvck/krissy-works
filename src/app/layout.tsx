import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'Brilliant Metal Works',
  description: 'Project Workflow System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
