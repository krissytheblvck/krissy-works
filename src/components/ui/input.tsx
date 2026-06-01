import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  unit?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, unit, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted',
              'focus:outline-none focus:ring-2 focus:ring-stone-600 focus:border-transparent dark:focus:ring-stone-400',
              'disabled:bg-surface-muted disabled:text-muted transition-colors duration-200',
              unit && 'pr-12',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
              {unit}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
