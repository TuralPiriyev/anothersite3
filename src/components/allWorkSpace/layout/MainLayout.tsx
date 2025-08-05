// src/components/allWorkSpace/layout/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './Header';
import CollaborationBridge from './CollaborationBridge';
import WorkspacePanel from '../panels/WorkspacePanel';
import PortfolioPanel from '../panels/PortfolioPanel';
import ToolsPanel from '../panels/ToolsPanel';
import CollaborativeCursors, { CursorData } from '../workspace/CollaborativeCursors';
import { useDatabase } from '../../../context/DatabaseContext';

const MainLayout: React.FC = () => {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [collaborativeCursors, setCollaborativeCursors] = useState<CursorData[]>([]);
  const [isCollaborationConnected, setIsCollaborationConnected] = useState(false);

  const { currentSchema } = useDatabase();

  useEffect(() => {
    // Listen for collaboration events from RealTimeCollaboration component
    // This prevents duplicate connections and event handler conflicts
    
    const handleCollaborationUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      
      switch (type) {
        case 'cursor_update':
          // Enhanced validation for cursor data
          if (data && 
              typeof data === 'object' && 
              data.userId && 
              typeof data.userId === 'string' &&
              data.userId.trim().length > 0 &&
              data.position &&
              typeof data.position === 'object' &&
              typeof data.position.x === 'number' &&
              typeof data.position.y === 'number') {
            
            setCollaborativeCursors(prev => {
              const filtered = prev.filter(c => c.userId !== data.userId);
              const newCursor: CursorData = {
                userId: data.userId,
                username: data.username || 'Unknown User',
                position: {
                  x: Math.max(0, Math.min(data.position.x, window.innerWidth)),
                  y: Math.max(0, Math.min(data.position.y, window.innerHeight))
                },
                color: data.color || '#3B82F6',
                selection: data.selection,
                lastSeen: data.lastSeen || new Date()
              };
              
              console.log('📍 Adding cursor to MainLayout:', {
                userId: newCursor.userId,
                username: newCursor.username,
                position: newCursor.position
              });
              
              return [...filtered, newCursor];
            });
          } else {
            console.warn('⚠️ Invalid cursor data received in MainLayout:', {
              data,
              hasUserId: !!(data?.userId),
              hasPosition: !!(data?.position),
              hasValidPosition: !!(data?.position && 
                typeof data.position.x === 'number' && 
                typeof data.position.y === 'number')
            });
          }
          break;
          
        case 'user_left':
          if (data && data.userId) {
            setCollaborativeCursors(prev => prev.filter(c => c.userId !== data.userId));
          }
          break;
          
        case 'connection_status':
          setIsCollaborationConnected(data.connected);
          break;
          
        case 'member_added':
          // Handle member addition
          if (data && data.member) {
            console.log('👥 Member added in MainLayout:', data.member.username);
          }
          break;
          
        case 'workspace_sync':
          // Handle complete workspace synchronization
          if (data && data.schema) {
            console.log('🔄 Syncing workspace state from remote user');
            // This would update the current schema with remote changes
            // For now, just log the sync event
          }
          break;
          
        default:
          // Handle other collaboration events if needed
          break;
      }
    };

    // Listen for collaboration events from RealTimeCollaboration component
    window.addEventListener('collaboration-event', handleCollaborationUpdate as EventListener);

    return () => {
      window.removeEventListener('collaboration-event', handleCollaborationUpdate as EventListener);
    };
  }, [currentSchema?.id]);

  // Panel toggles
  const toggleLeftPanel = () => setLeftPanelOpen(p => !p);
  const toggleRightPanel = () => setRightPanelOpen(p => !p);
  const toggleLeftCollapse = () => setLeftPanelCollapsed(p => !p);
  const toggleRightCollapse = () => setRightPanelCollapsed(p => !p);

  // Enhanced cursor move broadcast - now sends cursor updates for all users
  const handleCursorMove = (pos: { x: number; y: number; tableId?: string; columnId?: string }) => {
    // Always broadcast cursor position if collaboration is connected
    if (isCollaborationConnected && 
        pos && 
        typeof pos.x === 'number' && 
        typeof pos.y === 'number') {
      
      // Dispatch cursor move event to RealTimeCollaboration component
      window.dispatchEvent(new CustomEvent('cursor-move', {
        detail: { position: pos }
      }));
    }
  };

  // Add global mouse move listener to track cursor position
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isCollaborationConnected) {
        const position = {
          x: e.clientX,
          y: e.clientY
        };
        
        // Dispatch cursor move event
        window.dispatchEvent(new CustomEvent('cursor-move', {
          detail: { position }
        }));
      }
    };

    // Add global mouse move listener
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isCollaborationConnected]);
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
      {/* Background collaboration connection */}
      <CollaborationBridge />
      <Header />
      
      {/* Collaboration Status Indicator - Only show in development */}
      {import.meta.env.DEV && (
        <div className="fixed top-20 right-4 z-50">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isCollaborationConnected 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
          }`}>
            {isCollaborationConnected ? '🟢 Collaboration Active' : '🟡 Collaboration Offline'}
          </div>
        </div>
      )}
      
      {/* Collaborative Cursors Overlay */}
      <CollaborativeCursors 
        cursors={collaborativeCursors}
        onCursorMove={handleCursorMove}
      />
      
      <div className="flex-1 flex relative">
        {/* Mobile Menu Buttons */}
        <div className="lg:hidden absolute top-4 left-4 z-50">
          <button
            onClick={toggleLeftPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={leftPanelOpen ? "Close tools panel" : "Open tools panel"}
          >
            {leftPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        <div className="lg:hidden absolute top-4 right-4 z-50">
          <button
            onClick={toggleRightPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={rightPanelOpen ? "Close portfolio panel" : "Open portfolio panel"}
          >
            {rightPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Left Panel - Advanced Tools */}
        <div className={`
          fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${leftPanelCollapsed ? 'lg:w-12' : 'w-80 lg:w-1/5 lg:min-w-80'}
        `}>
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -right-3 z-50">
            <button
              onClick={toggleLeftCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={leftPanelCollapsed ? "Expand tools panel" : "Collapse tools panel"}
            >
              {leftPanelCollapsed ? (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          <ToolsPanel isCollapsed={leftPanelCollapsed} />
        </div>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col relative">
          <WorkspacePanel />
        </div>

        {/* Right Panel - Portfolio */}
        <div className={`
          fixed inset-y-0 right-0 z-40 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${rightPanelCollapsed ? 'lg:w-12' : 'w-80 lg:w-1/5 lg:min-w-80'}
        `}>
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -left-3 z-50">
            <button
              onClick={toggleRightCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={rightPanelCollapsed ? "Expand portfolio panel" : "Collapse portfolio panel"}
            >
              {rightPanelCollapsed ? (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          <PortfolioPanel isCollapsed={rightPanelCollapsed} />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;