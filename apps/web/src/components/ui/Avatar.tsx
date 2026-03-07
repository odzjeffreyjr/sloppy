import { motion } from 'framer-motion';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  borderColorClass?: string;
}

function getInitial(name?: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const borderColors = [
  'border-sloppy-primary',
  'border-sloppy-secondary',
  'border-sloppy-success',
  'border-sloppy-warning',
];

export function Avatar({ src, name, size = 40, className = '', borderColorClass }: AvatarProps) {
  const borderColor = borderColorClass ?? borderColors[
    (name?.charCodeAt(0) ?? 0) % borderColors.length
  ];

  return (
    <motion.div
      className={`
        rounded-full overflow-hidden border-3
        flex items-center justify-center
        bg-sloppy-surface font-heading text-sloppy-text font-bold
        ${borderColor} ${className}
      `}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      whileHover={{ scale: 1.1, rotate: 5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {src ? (
        <img src={src} alt={name ?? 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        <span>{getInitial(name)}</span>
      )}
    </motion.div>
  );
}
