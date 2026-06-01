'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="brilliant-theme"
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  )
}
