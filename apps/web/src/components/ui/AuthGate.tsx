import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { SloppyButton } from './SloppyButton';

interface AuthGateProps {
  feature: string;
  description?: string;
}

export function AuthGate({ feature, description }: AuthGateProps) {
  const { login } = useAuthStore();

  return (
    <motion.div
      className="py-20 flex flex-col items-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="text-sloppy-text-muted"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Lock size={48} />
      </motion.div>
      <h2 className="font-heading text-xl text-sloppy-text text-center">
        Sign in to {feature}
      </h2>
      {description && (
        <p className="text-sm text-sloppy-text-muted text-center max-w-sm">{description}</p>
      )}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <SloppyButton onClick={() => login('google')} className="w-full">
          Sign in with Google
        </SloppyButton>
        <SloppyButton
          variant="ghost"
          onClick={() => login('anonymous')}
          className="w-full"
        >
          Continue as Guest
        </SloppyButton>
      </div>
    </motion.div>
  );
}
