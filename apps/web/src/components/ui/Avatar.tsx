import { motion } from 'framer-motion';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

function getInitial(name?: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const borderColors = [
  'border-sloppy-pink',
  'border-sloppy-cyan',
  'border-sloppy-lime',
  'border-sloppy-yellow',
];

export function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const borderColor = borderColors[
    (name?.charCodeAt(0) ?? 0) % borderColors.length
  ];

  return (
    <motion.div
      className={`
        rounded-full overflow-hidden border-3
        flex items-center justify-center
        bg-sloppy-cream font-heading text-sloppy-dark font-bold
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
