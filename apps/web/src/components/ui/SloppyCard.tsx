import { motion, type HTMLMotionProps } from 'framer-motion';
import { useMemo } from 'react';

interface SloppyCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  children: React.ReactNode;
  tilt?: boolean;
}

export function SloppyCard({ children, tilt = true, className = '', ...props }: SloppyCardProps) {
  const rotation = useMemo(
    () => (tilt ? Math.random() * 2 - 1 : 0), // -1deg to 1deg
    [tilt],
  );

  return (
    <motion.div
      className={`
        bg-white rounded-wobbly-lg p-5
        shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]
        border-2 border-sloppy-dark/5
        ${className}
      `}
      style={{ rotate: rotation }}
      whileHover={{
        y: -6,
        rotate: 0,
        boxShadow: '6px 8px 0px 0px rgba(0,0,0,0.12)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
