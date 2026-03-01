import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/ui';
import { useMultiplayerStore } from '../stores/multiplayer';
import { SloppySpinner } from '../components/ui/SloppySpinner';

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isGameOverlayOpen, openGameOverlay } = useUIStore();
  const { joinSession, openModal } = useMultiplayerStore();
  const hasAutoJoined = useRef(false);
  const didOpen = useRef(false);

  const sessionId = searchParams.get('session');

  // Open the overlay once when this route mounts (or when id changes).
  // Intentionally omit isGameOverlayOpen — reacting to it closing would
  // reopen the overlay before React Router finishes navigating away.
  useEffect(() => {
    if (id) {
      didOpen.current = true;
      openGameOverlay(id);
    }
  }, [id, openGameOverlay]);

  // When the overlay is closed (by user or Escape), navigate back so we
  // don't sit on /game/:id with a hidden overlay.
  useEffect(() => {
    if (didOpen.current && !isGameOverlayOpen) {
      didOpen.current = false;
      navigate(-1);
    }
  }, [isGameOverlayOpen, navigate]);

  // Auto-join a multiplayer session when ?session= is present in the URL
  useEffect(() => {
    if (sessionId && isGameOverlayOpen && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      openModal();
      joinSession(sessionId);
    }
  }, [sessionId, isGameOverlayOpen, joinSession, openModal]);

  if (isGameOverlayOpen) return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <SloppySpinner size={64} />
    </div>
  );
}
