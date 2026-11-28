import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui Button, themed for the editor.
const buttonVariants = cva('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45', {
  variants: {
    variant: {
      default: 'bg-primary text-white hover:bg-primary/90',
      outline: 'border border-line bg-white text-ink hover:bg-muted',
      ghost: 'text-ink hover:bg-muted',
    },
    size: { default: 'h-9 px-3.5', icon: 'size-9', small: 'h-8 px-2.5' },
  }, defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({ className, variant, size, asChild, ...props }: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={twMerge(clsx(buttonVariants({ variant, size }), className))} {...props}/>;
}
