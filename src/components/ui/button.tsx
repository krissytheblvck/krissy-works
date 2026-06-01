import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-stone-900 text-stone-50 hover:bg-stone-800 focus:ring-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 dark:focus:ring-stone-300':
              variant === 'primary',
            'bg-surface text-foreground border border-border hover:bg-surface-hover focus:ring-stone-400 dark:focus:ring-stone-500':
              variant === 'secondary',
            'text-muted hover:bg-surface-hover hover:text-foreground focus:ring-stone-400':
              variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600': variant === 'danger',
          },
          {
            'text-xs px-3 py-1.5 gap-1.5': size === 'sm',
            'text-sm px-4 py-2 gap-2': size === 'md',
            'text-base px-6 py-3 gap-2': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
