import { motion } from 'framer-motion';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface SloppyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart'> {
  accentColor?: 'pink' | 'cyan' | 'lime' | 'yellow';
}

const glowColors = {
  pink: 'focus:ring-sloppy-pink/40 focus:border-sloppy-pink',
  cyan: 'focus:ring-sloppy-cyan/40 focus:border-sloppy-cyan',
  lime: 'focus:ring-sloppy-lime/40 focus:border-sloppy-lime',
  yellow: 'focus:ring-sloppy-yellow/40 focus:border-sloppy-yellow',
};

export const SloppyInput = forwardRef<HTMLInputElement, SloppyInputProps>(
  ({ accentColor = 'pink', className = '', ...props }, ref) => (
    <motion.input
      ref={ref}
      className={`
        w-full px-4 py-3 text-lg font-body
        bg-white rounded-wobbly
        border-2 border-dashed border-sloppy-dark/20
        outline-none ring-0 focus:ring-4
        transition-colors placeholder:text-sloppy-dark/30
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
