'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedbackVariant = 'error' | 'success' | 'warning'

const VARIANT_STYLES: Record<FeedbackVariant, string> = {
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200',
}

interface FeedbackBannerProps {
  message: string | null
  variant?: FeedbackVariant
  onDismiss?: () => void
  className?: string
}

export function FeedbackBanner({
  message,
  variant = 'error',
  onDismiss,
  className,
}: FeedbackBannerProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
        VARIANT_STYLES[variant],
        className
      )}
    >
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
