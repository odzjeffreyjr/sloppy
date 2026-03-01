import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useUIStore } from '../stores/ui';
import { useMultiplayerStore } from '../stores/multiplayer';
import { SloppySpinner } from '../components/ui/SloppySpinner';

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isGameOverlayOpen, openGameOverlay } = useUIStore();
  const { joinSession, openModal } = useMultiplayerStore();
  const hasAutoJoined = useRef(false);

  const sessionId = searchParams.get('session');

  // Open the game overlay when navigating to /game/:id
  useEffect(() => {
    if (id && !isGameOverlayOpen) {
      openGameOverlay(id);
    }
  }, [id, isGameOverlayOpen, openGameOverlay]);

  // Auto-join a multiplayer session when ?session= is present in the URL
  useEffect(() => {
    if (sessionId && isGameOverlayOpen && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      openModal();
      joinSession(sessionId);
    }
  }, [sessionId, isGameOverlayOpen, joinSession, openModal]);

  // Reset the guard when the overlay closes so re-opening works
  useEffect(() => {
    if (!isGameOverlayOpen) {
      hasAutoJoined.current = false;
    }
  }, [isGameOverlayOpen]);

  if (isGameOverlayOpen) return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <SloppySpinner size={64} />
    </div>
  );
}
