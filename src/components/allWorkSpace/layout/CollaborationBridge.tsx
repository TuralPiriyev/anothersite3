import { useEffect } from 'react';
import { useDatabase } from '../../../context/DatabaseContext';
import { useAuth } from '../../../context/AuthContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { collaborationService, CollaborationUser } from '../../../services/collaborationService';

/**
 * Keeps the collaboration WebSocket connection alive in the background
 * and forwards important events to MainLayout via the existing
 * `collaboration-event` CustomEvent bus.
 */
const CollaborationBridge: React.FC = () => {
  const { currentSchema, setCurrentSchema } = useDatabase();
  const { user } = useAuth();
  const { currentPlan } = useSubscription();

  useEffect(() => {
    // Only connect for shared workspaces (Ultimate plan for now)
    if (currentPlan !== 'ultimate' || !currentSchema?.id) return;

    const curUser: CollaborationUser = {
      id: user?.id || `user_${Date.now()}`,
      username: user?.username || 'anonymous',
      role: 'viewer',
      color: user?.color || '#3B82F6'
    };

    // Initialise & connect if not already
    if (!collaborationService.isConnectedState()) {
      collaborationService.initialize(curUser, currentSchema.id);
      collaborationService.connect().catch(err => console.error('Collaboration connect error:', err));
    }

    /* ---------------- event relays ---------------- */
    const relay = (type: string, data: any) => {
      window.dispatchEvent(new CustomEvent('collaboration-event', { detail: { type, data } }));
    };

    const handleCursor = (cursor: any) => relay('cursor_update', cursor);
    const handleLeft   = (uid: string) => relay('user_left', { userId: uid });
    const handleConn   = () => relay('connection_status', { connected: true });
    const handleDisc   = () => relay('connection_status', { connected: false });

    const handleJoin   = (userData: any) => {
      // Ensure DatabaseContext members list stays in sync
      setCurrentSchema(prev => {
        const exists = prev.members.some(m => m.username === userData.username);
        if (exists) return prev;
        
        const newMember = {
          id: userData.id || userData.userId || userData.username,
          username: userData.username,
          role: userData.role || 'editor',
          joinedAt: new Date()
        };
        
        return {
          ...prev,
          members: [...prev.members, newMember],
          isShared: true,
          updatedAt: new Date()
        };
      });
      relay('user_joined', userData);
    };

    collaborationService.on('cursor_update', handleCursor);
    collaborationService.on('user_left', handleLeft);
    collaborationService.on('user_joined', handleJoin);
    collaborationService.on('connected', handleConn);
    collaborationService.on('disconnected', handleDisc);

    // Forward local cursor-move events directly to the service
    const localMoveListener = (e: CustomEvent<{ position: { x:number; y:number } }>) => {
      const { position } = e.detail;
      if (collaborationService.isConnectedState() && position) {
        collaborationService.sendCursorUpdate(position);
      }
    };
    window.addEventListener('cursor-move', localMoveListener as EventListener);

    return () => {
      collaborationService.off('cursor_update', handleCursor);
      collaborationService.off('user_left', handleLeft);
      collaborationService.off('user_joined', handleJoin);
      collaborationService.off('connected', handleConn);
      collaborationService.off('disconnected', handleDisc);
      window.removeEventListener('cursor-move', localMoveListener as EventListener);
    };
  }, [currentPlan, currentSchema?.id, user?.id]);

  return null; // headless
};

export default CollaborationBridge;