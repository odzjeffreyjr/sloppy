import { motion, type HTMLMotionProps } from 'framer-motion';
import { useCallback, useRef } from 'react';

interface SloppyCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  children: React.ReactNode;
  tilt?: boolean;
}

export function SloppyCard({ children, tilt = true, className = '', ...props }: SloppyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!tilt || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardRef.current.style.transform = `perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    },
    [tilt],
  );

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
    }
  }, []);

  return (
    <motion.div
      ref={cardRef}
      className={`
        bg-sloppy-surface rounded-wobbly-lg p-5
        border border-sloppy-border
        transition-[transform,box-shadow] duration-200 ease-out
        hover:border-sloppy-primary/20 hover:shadow-lg hover:shadow-sloppy-primary/5
        ${className}
      `}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: 'preserve-3d' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
