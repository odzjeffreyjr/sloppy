import { motion } from 'framer-motion';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface SloppyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart'> {
  accentColor?: 'primary' | 'secondary' | 'pink' | 'cyan';
}

const glowColors = {
  primary: 'focus:ring-sloppy-primary/40 focus:border-sloppy-primary',
  secondary: 'focus:ring-sloppy-secondary/40 focus:border-sloppy-secondary',
  pink: 'focus:ring-sloppy-pink/40 focus:border-sloppy-pink',
  cyan: 'focus:ring-sloppy-cyan/40 focus:border-sloppy-cyan',
};

export const SloppyInput = forwardRef<HTMLInputElement, SloppyInputProps>(
  ({ accentColor = 'primary', className = '', ...props }, ref) => (
    <motion.input
      ref={ref}
      className={`
        w-full px-4 py-3 text-sm font-body
        bg-sloppy-surface text-sloppy-text rounded-wobbly
        border border-sloppy-border
        outline-none ring-0 focus:ring-2
        transition-all placeholder:text-sloppy-text-muted/50
        ${glowColors[accentColor]}
        ${className}
      `}
      whileFocus={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...props}
    />
  ),
);

SloppyInput.displayName = 'SloppyInput';
