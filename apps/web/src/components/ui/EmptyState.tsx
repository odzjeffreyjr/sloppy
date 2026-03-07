import { motion } from 'framer-motion';
import { SloppyButton } from './SloppyButton';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      className="py-20 flex flex-col items-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="text-sloppy-text-muted"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      <h2 className="font-heading text-xl text-sloppy-text text-center">{title}</h2>
      {description && (
        <p className="text-sm text-sloppy-text-muted text-center max-w-sm">{description}</p>
      )}
      {action && (
        <SloppyButton onClick={action.onClick}>{action.label}</SloppyButton>
      )}
    </motion.div>
  );
}
