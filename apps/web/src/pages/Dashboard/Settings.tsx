import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/auth';
import { SloppyButton } from '../../components/ui/SloppyButton';
import { SloppyModal } from '../../components/ui/SloppyModal';
import { SloppySpinner } from '../../components/ui/SloppySpinner';
import { toast } from '../../components/ui/SloppyToast';
import { subscriptionApi } from '../../lib/api';

interface SubscriptionStatus {
  status: 'none' | 'active' | 'past_due' | 'canceled';
  isSubscribed: boolean;
  currentPeriodEnd: string | null;
}

export default function Settings() {
  const { isAuthenticated, user, login } = useAuthStore();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const res = await subscriptionApi.getStatus();
      setSub(res.data);
    } catch {
      toast('Failed to load subscription status', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast('Subscription activated! You can now create games.', 'success');
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      toast('Checkout canceled', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStatus]);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await subscriptionApi.createCheckout({
        successUrl: `${window.location.origin}/dashboard/settings?success=true`,
        cancelUrl: `${window.location.origin}/dashboard/settings?canceled=true`,
      });
      window.location.href = res.data.checkoutUrl;
    } catch {
      toast('Failed to start checkout', 'error');
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await subscriptionApi.cancel();
      toast('Subscription canceled', 'info');
      setShowCancelModal(false);
      await fetchStatus();
    } catch {
      toast('Failed to cancel subscription', 'error');
    } finally {
      setCanceling(false);
    }
  };

  const handleManage = async () => {
    try {
      const res = await subscriptionApi.portal({
        returnUrl: `${window.location.origin}/dashboard/settings`,
      });
      window.location.href = res.data.portalUrl;
    } catch {
      toast('Failed to open billing portal', 'error');
    }
  };

  const handleLogin = async (method: 'google' | 'anonymous') => {
    await login(method);
    setShowAuthModal(false);
  };

  const renewalDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <motion.div
      className="max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <h1 className="font-heading text-3xl text-sloppy-text mb-1">Settings</h1>
      <p className="text-sloppy-text-muted text-sm mb-6">Manage your account and subscription</p>

      {/* Subscription Card */}
      <motion.div
        className="bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-heading text-2xl text-sloppy-text">Creator Plan</h2>
            <p className="text-sloppy-text-muted text-sm mt-1">
              Create and publish AI-generated games
            </p>
          </div>
          <div className="text-right">
            <span className="font-heading text-3xl text-sloppy-text">$5</span>
            <span className="text-sloppy-text-muted">/mo</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <SloppySpinner size={40} />
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-6">
            <p className="text-sloppy-text-muted mb-4">Sign in to manage your subscription</p>
            <SloppyButton onClick={() => setShowAuthModal(true)}>
              Sign In
            </SloppyButton>
          </div>
        ) : sub?.isSubscribed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-sloppy-success/10 rounded-wobbly">
              <div className="w-3 h-3 rounded-full bg-sloppy-success animate-pulse" />
              <span className="font-heading text-sloppy-text">Active</span>
              {renewalDate && (
                <span className="text-sm text-sloppy-text-muted ml-auto">
                  Renews {renewalDate}
                </span>
              )}
            </div>

            <ul className="space-y-2 text-sm text-sloppy-text-muted">
              <li className="flex items-center gap-2">
                <span className="text-sloppy-success">&#10003;</span> Unlimited game creation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sloppy-success">&#10003;</span> Publish to the feed
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sloppy-success">&#10003;</span> Creator analytics & earnings
              </li>
            </ul>

            <div className="flex gap-3 pt-2">
              <SloppyButton variant="ghost" onClick={handleManage}>
                Manage Billing
              </SloppyButton>
              <SloppyButton
                variant="ghost"
                onClick={() => setShowCancelModal(true)}
                className="!text-sloppy-danger !border-sloppy-danger/30 hover:!bg-sloppy-danger/10"
              >
                Cancel Plan
              </SloppyButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-sloppy-surface-hover rounded-wobbly">
              <div className="w-3 h-3 rounded-full bg-sloppy-text-muted/40" />
              <span className="font-heading text-sloppy-text-muted">
                {sub?.status === 'canceled' ? 'Canceled' : 'Not subscribed'}
              </span>
            </div>

            <ul className="space-y-2 text-sm text-sloppy-text-muted">
              <li className="flex items-center gap-2">
                <span className="text-sloppy-success">&#10003;</span> Browse & play all games
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sloppy-text-muted/40">&#10007;</span> Game creation (requires plan)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sloppy-text-muted/40">&#10007;</span> Publish to the feed
              </li>
            </ul>

            <SloppyButton onClick={handleSubscribe} className="w-full text-lg py-4">
              Subscribe — $5/month
            </SloppyButton>
          </div>
        )}
      </motion.div>

      {/* Account Info */}
      {isAuthenticated && user && (
        <motion.div
          className="mt-6 bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-heading text-xl text-sloppy-text mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-sloppy-text-muted">Email</span>
              <span className="text-sloppy-text">{user.email || 'Anonymous'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sloppy-text-muted">Display Name</span>
              <span className="text-sloppy-text">{user.displayName || '—'}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cancel Confirmation Modal */}
      <SloppyModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel subscription?"
      >
        <p className="text-sloppy-text-muted mb-6">
          Your subscription will remain active until the end of the current billing period.
          You won&apos;t be able to create new games after that.
        </p>
        <div className="flex gap-3 justify-end">
          <SloppyButton variant="ghost" onClick={() => setShowCancelModal(false)}>
            Keep Plan
          </SloppyButton>
          <SloppyButton
            onClick={handleCancel}
            disabled={canceling}
            className="!bg-sloppy-danger hover:!bg-sloppy-danger/90"
          >
            {canceling ? 'Canceling...' : 'Yes, Cancel'}
          </SloppyButton>
        </div>
      </SloppyModal>

      {/* Auth Modal */}
      <SloppyModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to continue"
      >
        <p className="text-sloppy-text-muted mb-6">
          Create an account to subscribe and start creating games.
        </p>
        <div className="flex flex-col gap-3">
          <SloppyButton onClick={() => handleLogin('google')} className="w-full">
            Sign in with Google
          </SloppyButton>
          <SloppyButton
            variant="ghost"
            onClick={() => handleLogin('anonymous')}
            className="w-full"
          >
            Continue as Guest
          </SloppyButton>
        </div>
      </SloppyModal>
    </motion.div>
  );
}
