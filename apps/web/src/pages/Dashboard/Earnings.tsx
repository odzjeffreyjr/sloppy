import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Gem } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { AuthGate } from '../../components/ui/AuthGate';
import { SloppyButton } from '../../components/ui/SloppyButton';
import { SloppyModal } from '../../components/ui/SloppyModal';
import { SloppySpinner } from '../../components/ui/SloppySpinner';
import { toast } from '../../components/ui/SloppyToast';
import {
  paymentsApi,
  type EarningsRecord,
  type ConnectStatus,
  type PayoutRecord,
} from '../../lib/api';

const PAYOUT_THRESHOLD = 60;

export default function Earnings() {
  const navigate = useNavigate();
  const { isAuthenticated, isSubscribed } = useAuthStore();

  const [balance, setBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [totalPaidOut, setTotalPaidOut] = useState<number>(0);
  const [earnings, setEarnings] = useState<EarningsRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payingOut, setPayingOut] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !isSubscribed) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [balanceRes, earningsRes, connectRes, payoutsRes] =
        await Promise.allSettled([
          paymentsApi.getBalance(),
          paymentsApi.getEarnings(),
          paymentsApi.getConnectStatus(),
          paymentsApi.getPayoutHistory(),
        ]);

      if (balanceRes.status === 'fulfilled') {
        setBalance(balanceRes.value.data.balance);
        setTotalEarned(balanceRes.value.data.totalEarned);
        setTotalPaidOut(balanceRes.value.data.totalPaidOut);
      }
      if (earningsRes.status === 'fulfilled') {
        setEarnings(earningsRes.value.data.earnings);
      }
      if (connectRes.status === 'fulfilled') {
        setConnectStatus(connectRes.value.data);
      }
      if (payoutsRes.status === 'fulfilled') {
        setPayouts(payoutsRes.value.data);
      }
    } catch {
      toast('Failed to load earnings data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isSubscribed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWithdraw = async () => {
    if (!connectStatus?.hasAccount || !connectStatus.onboardingComplete) {
      try {
        const res = await paymentsApi.connectStripe();
        window.location.href = res.data.onboardingUrl;
      } catch {
        toast('Failed to start Stripe onboarding', 'error');
      }
      return;
    }

    setShowPayoutModal(true);
  };

  const confirmPayout = async () => {
    setPayingOut(true);
    try {
      const res = await paymentsApi.requestPayout();
      toast(`Payout of $${res.data.amount.toFixed(2)} initiated!`, 'success');
      setShowPayoutModal(false);
      await loadData();
    } catch {
      toast('Failed to request payout', 'error');
    } finally {
      setPayingOut(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthGate feature="view earnings" description="You need an active subscription to access earnings." />
    );
  }

  if (!isSubscribed) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-4 py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Gem size={48} className="text-sloppy-text-muted" />
        <h2 className="font-heading text-2xl text-sloppy-text text-center">
          Creator Plan Required
        </h2>
        <p className="text-sloppy-text-muted text-center max-w-sm">
          Subscribe to the Creator Plan to start earning from your games.
        </p>
        <SloppyButton onClick={() => navigate('/dashboard/settings')}>
          View Plans
        </SloppyButton>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <SloppySpinner size={48} />
      </div>
    );
  }

  const canWithdraw = balance >= PAYOUT_THRESHOLD;
  const needsStripeOnboarding =
    !connectStatus?.hasAccount || !connectStatus.onboardingComplete;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div>
        <h1 className="font-heading text-3xl text-sloppy-text">Earnings</h1>
        <p className="text-sloppy-text-muted text-sm mt-1">
          Track your ad revenue and withdraw your earnings
        </p>
      </div>

      {/* Balance Card */}
      <motion.div
        className="bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <p className="text-sloppy-text-muted text-sm mb-1">Current Balance</p>
        <div className="flex items-end gap-4 mb-4">
          <span className="font-heading text-5xl text-sloppy-text">
            ${balance.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-6 text-sm text-sloppy-text-muted mb-5">
          <div>
            <span className="block text-sloppy-text font-medium">
              ${totalEarned.toFixed(2)}
            </span>
            Total Earned
          </div>
          <div>
            <span className="block text-sloppy-text font-medium">
              ${totalPaidOut.toFixed(2)}
            </span>
            Total Paid Out
          </div>
        </div>

        <SloppyButton
          onClick={handleWithdraw}
          disabled={!canWithdraw && !needsStripeOnboarding}
          className={!canWithdraw && !needsStripeOnboarding ? 'opacity-50' : ''}
        >
          {needsStripeOnboarding
            ? 'Connect Stripe Account'
            : canWithdraw
              ? `Withdraw $${balance.toFixed(2)}`
              : `Minimum $${PAYOUT_THRESHOLD} required`}
        </SloppyButton>
      </motion.div>

      {/* Monthly Earnings */}
      <motion.div
        className="bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-heading text-xl text-sloppy-text mb-4">
          Monthly Earnings
        </h2>

        {earnings.length === 0 ? (
          <p className="text-sloppy-text-muted text-sm py-4 text-center">
            No earnings data yet. Start publishing games to earn!
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-xs text-sloppy-text-muted font-medium pb-2 border-b border-sloppy-border">
              <span>Period</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Your Share (50%)</span>
              <span className="text-right">Status</span>
            </div>
            {earnings.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-sloppy-border/50"
              >
                <span className="text-sloppy-text">
                  {formatMonth(e.periodMonth)}
                </span>
                <span className="text-right text-sloppy-text">
                  ${parseFloat(e.grossRevenue).toFixed(2)}
                </span>
                <span className="text-right text-sloppy-primary font-medium">
                  ${parseFloat(e.creatorShare).toFixed(2)}
                </span>
                <span className="text-right">
                  <StatusBadge status={e.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Payout History */}
      <motion.div
        className="bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="font-heading text-xl text-sloppy-text mb-4">
          Payout History
        </h2>

        {payouts.length === 0 ? (
          <p className="text-sloppy-text-muted text-sm py-4 text-center">
            No payouts yet.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-sloppy-text-muted font-medium pb-2 border-b border-sloppy-border">
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
            {payouts.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-3 gap-2 text-sm py-2 border-b border-sloppy-border/50"
              >
                <span className="text-sloppy-text">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                <span className="text-right text-sloppy-text font-medium">
                  ${p.amount.toFixed(2)}
                </span>
                <span className="text-right">
                  <StatusBadge status={p.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Payout Confirmation Modal */}
      <SloppyModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        title="Confirm Withdrawal"
      >
        <p className="text-sloppy-text-muted mb-6">
          You are about to withdraw{' '}
          <span className="text-sloppy-text font-semibold">
            ${balance.toFixed(2)}
          </span>{' '}
          to your connected Stripe account. This usually takes 2-3 business days.
        </p>
        <div className="flex gap-3 justify-end">
          <SloppyButton
            variant="ghost"
            onClick={() => setShowPayoutModal(false)}
          >
            Cancel
          </SloppyButton>
          <SloppyButton onClick={confirmPayout} disabled={payingOut}>
            {payingOut ? 'Processing...' : 'Confirm Withdrawal'}
          </SloppyButton>
        </div>
      </SloppyModal>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: 'bg-sloppy-warning/20 text-sloppy-warning',
    confirmed: 'bg-sloppy-secondary/20 text-sloppy-secondary',
    paid: 'bg-sloppy-success/20 text-sloppy-success',
    completed: 'bg-sloppy-success/20 text-sloppy-success',
    processing: 'bg-sloppy-secondary/20 text-sloppy-secondary',
    failed: 'bg-sloppy-danger/20 text-sloppy-danger',
  };

  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-wobbly ${
        colorMap[status] ?? 'bg-sloppy-surface-hover text-sloppy-text-muted'
      }`}
    >
      {status}
    </span>
  );
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}
