import { motion } from 'framer-motion';

interface SloppySpinnerProps {
  size?: number;
  className?: string;
}

const shapes = [
  { color: 'bg-sloppy-pink', delay: 0 },
  { color: 'bg-sloppy-cyan', delay: 0.15 },
  { color: 'bg-sloppy-lime', delay: 0.3 },
  { color: 'bg-sloppy-yellow', delay: 0.45 },
];

export function SloppySpinner({ size = 48, className = '' }: SloppySpinnerProps) {
  const dotSize = size / 4;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${shape.color}`}
          style={{
            width: dotSize,
            height: dotSize,
            top: '50%',
            left: '50%',
            marginTop: -dotSize / 2,
            marginLeft: -dotSize / 2,
          }}
          animate={{
            x: [0, size / 3, 0, -size / 3, 0],
            y: [-(size / 3), 0, size / 3, 0, -(size / 3)],
            scale: [1, 1.3, 0.8, 1.2, 1],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: shape.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
