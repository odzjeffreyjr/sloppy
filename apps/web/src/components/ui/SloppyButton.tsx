import { motion, type HTMLMotionProps } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost';

interface SloppyButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-sloppy-pink text-white shadow-lg shadow-sloppy-pink/30 hover:shadow-sloppy-pink/50',
  secondary:
    'bg-sloppy-cyan text-sloppy-dark shadow-lg shadow-sloppy-cyan/30 hover:shadow-sloppy-cyan/50',
  ghost:
    'bg-transparent text-sloppy-dark border-2 border-sloppy-dark/20 hover:border-sloppy-pink',
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
        font-heading cursor-pointer px-6 py-3 text-lg font-bold
        rounded-wobbly transition-colors
        ${variantClasses[variant]}
        ${className}
      `}
      whileHover={{ scale: 1.05, rotate: [0, -2, 2, -1, 0] }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
