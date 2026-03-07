import { motion, type HTMLMotionProps } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost';

interface SloppyButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-sloppy-primary text-white shadow-lg shadow-sloppy-primary/25 hover:shadow-sloppy-primary/40 hover:bg-sloppy-primary/90',
  secondary:
    'bg-sloppy-secondary text-white shadow-lg shadow-sloppy-secondary/25 hover:shadow-sloppy-secondary/40 hover:bg-sloppy-secondary/90',
  ghost:
    'bg-transparent text-sloppy-text border border-sloppy-border hover:bg-sloppy-surface-hover hover:border-sloppy-primary/40',
};

export function SloppyButton({
  variant = 'primary',
  children,
  className = '',
  ...props
}: SloppyButtonProps) {
  return (
    <motion.button
      className={`
        font-body cursor-pointer px-6 py-3 text-sm font-semibold
        rounded-full transition-all
        ${variantClasses[variant]}
        ${className}
      `}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
