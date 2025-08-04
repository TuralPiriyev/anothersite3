import React, { useEffect, useState } from 'react';
import { MousePointer } from 'lucide-react';

interface CursorData {
  userId: string;
  username: string;
  position: { x: number; y: number };
  color: string;
  selection?: {
    tableId: string;
    columnId?: string;
  };
  lastSeen: Date | string;
}

interface CollaborativeCursorsProps {
  cursors: CursorData[];
  onCursorMove?: (position: { x: number; y: number }) => void;
}

const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({ 
  cursors, 
  onCursorMove 
}) => {
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = { x: e.clientX, y: e.clientY };
      setLocalCursor(newPosition);
      onCursorMove?.(newPosition);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [onCursorMove]);

  // Debug logging for cursors (development only)
  if (import.meta.env.DEV) {
    console.log('🖱️ CollaborativeCursors render:', {
      totalCursors: cursors.length,
      cursorsData: cursors.map(c => ({
        userId: c.userId,
        username: c.username,
        position: c.position,
        lastSeen: c.lastSeen
      }))
    });
  }

  // Filter out stale cursors (older than 30 seconds)
  const activeCursors = cursors.filter(cursor => {
    try {
      const lastSeenTime = cursor.lastSeen instanceof Date ? 
        cursor.lastSeen.getTime() : 
        new Date(cursor.lastSeen).getTime();
      const now = Date.now();
      const isActive = (now - lastSeenTime) < 30000; // 30 seconds
      
             if (import.meta.env.DEV) {
         console.log('🕐 Cursor age check:', {
           userId: cursor.userId,
           lastSeen: cursor.lastSeen,
           age: now - lastSeenTime,
           isActive
         });
       }
      
      return isActive;
    } catch (error) {
      console.warn('⚠️ Error filtering cursor:', error, cursor);
      return true; // Keep cursor if there's an error
    }
  });

  if (import.meta.env.DEV) {
    console.log('✅ Active cursors after filtering:', activeCursors.length);
  }

  if (activeCursors.length === 0) {
    if (import.meta.env.DEV) {
      console.log('🚫 No active cursors to render');
    }
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50" style={{ zIndex: 9999 }}>
      {activeCursors.map(cursor => {
        // Ensure valid position before rendering
        const x = typeof cursor.position?.x === 'number' ? cursor.position.x : 0;
        const y = typeof cursor.position?.y === 'number' ? cursor.position.y : 0;
        
        if (import.meta.env.DEV) {
          console.log('🎯 Rendering cursor:', {
            userId: cursor.userId,
            username: cursor.username,
            position: { x, y },
            color: cursor.color
          });
        }
        
        // More lenient boundary checking - allow cursors anywhere on screen
        if (isNaN(x) || isNaN(y)) {
          if (import.meta.env.DEV) {
            console.warn('🚫 Invalid cursor coordinates:', { x, y });
          }
          return null;
        }

        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-2px, -2px)',
              zIndex: 9999
            }}
          >
            {/* Cursor Icon */}
            <div className="relative">
              <MousePointer 
                className="w-5 h-5 drop-shadow-lg"
                style={{ 
                  color: cursor.color,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              
              {/* Username Label */}
              <div 
                className="absolute top-6 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap max-w-32 truncate"
                style={{ 
                  backgroundColor: cursor.color,
                  zIndex: 10000
                }}
              >
                {cursor.username || 'Anonymous'}
                {cursor.selection && (
                  <span className="ml-1 opacity-75">
                    editing {cursor.selection.tableId}
                  </span>
                )}
              </div>
            </div>

            {/* Selection Highlight */}
            {cursor.selection && (
              <div 
                className="absolute w-2 h-2 rounded-full animate-pulse"
                style={{ 
                  backgroundColor: cursor.color,
                  top: -4,
                  left: -4,
                  zIndex: 9998
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CollaborativeCursors;
export type { CursorData };