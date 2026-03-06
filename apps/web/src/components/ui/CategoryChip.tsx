import { motion } from 'framer-motion';

interface CategoryChipProps {
  label: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  color?: string;
}

export function CategoryChip({ label, icon, isActive = false, onClick, color }: CategoryChipProps) {
  return (
    <motion.button
      className={`
        cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
        whitespace-nowrap border transition-colors shrink-0
        ${isActive
          ? 'bg-sloppy-primary text-white border-sloppy-primary'
          : 'bg-sloppy-surface text-sloppy-text-muted border-sloppy-border hover:bg-sloppy-surface-hover hover:text-sloppy-text hover:border-sloppy-primary/30'}
      `}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      {icon && <span className="text-base">{icon}</span>}
      {color && !icon && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </motion.button>
  );
}

export function CategoryChipRow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-none ${className}`}>
      {children}
    </div>
  );
}
