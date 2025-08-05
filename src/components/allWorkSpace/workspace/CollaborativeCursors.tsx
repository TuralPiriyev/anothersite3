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

  // Filter out stale cursors (older than 30 seconds) and duplicates
  const activeCursors = cursors.filter(cursor => {
    const lastSeenTime = cursor.lastSeen instanceof Date ? 
      cursor.lastSeen.getTime() : 
      new Date(cursor.lastSeen).getTime();
    const now = Date.now();
    const isRecent = (now - lastSeenTime) < 30000; // 30 seconds
    
    // Additional validation
    const isValid = cursor.userId && 
                   cursor.username && 
                   cursor.position && 
                   typeof cursor.position.x === 'number' && 
                   typeof cursor.position.y === 'number' &&
                   !isNaN(cursor.position.x) && 
                   !isNaN(cursor.position.y);
    
    return isRecent && isValid;
  });

  // Remove duplicate cursors by userId
  const uniqueCursors = activeCursors.reduce((acc, cursor) => {
    const existing = acc.find(c => c.userId === cursor.userId);
    if (!existing) {
      acc.push(cursor);
    } else {
      // Update existing cursor if new one is more recent
      const existingTime = existing.lastSeen instanceof Date ? 
        existing.lastSeen.getTime() : 
        new Date(existing.lastSeen).getTime();
      const newTime = cursor.lastSeen instanceof Date ? 
        cursor.lastSeen.getTime() : 
        new Date(cursor.lastSeen).getTime();
      
      if (newTime > existingTime) {
        const index = acc.findIndex(c => c.userId === cursor.userId);
        acc[index] = cursor;
      }
    }
    return acc;
  }, [] as CursorData[]);

  // Debug log for cursor visibility
  useEffect(() => {
    if (uniqueCursors.length > 0) {
      console.log('🎯 Rendering unique cursors:', uniqueCursors.map(c => ({
        userId: c.userId,
        username: c.username,
        position: c.position,
        color: c.color
      })));
    }
  }, [uniqueCursors]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {uniqueCursors.map(cursor => {
        // Ensure valid position before rendering with better validation
        const x = typeof cursor.position?.x === 'number' && !isNaN(cursor.position.x) ? cursor.position.x : 0;
        const y = typeof cursor.position?.y === 'number' && !isNaN(cursor.position.y) ? cursor.position.y : 0;
        
        // More lenient position validation - allow cursors near screen edges
        if (x < -50 || y < -50 || x > window.innerWidth + 50 || y > window.innerHeight + 50) {
          console.warn('⚠️ Cursor position out of reasonable bounds:', { userId: cursor.userId, x, y });
          return null;
        }

        console.log('🎯 Rendering cursor for user:', cursor.userId, 'at position:', { x, y });

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-100 ease-out pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-2px, -2px)',
              zIndex: 9999
            }}
          >
            {/* Cursor Icon with enhanced visibility */}
            <div className="relative">
              <MousePointer 
                className="w-5 h-5 drop-shadow-lg filter"
                style={{ 
                  color: cursor.color,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              
              {/* Username Label with better contrast */}
              <div 
                className="absolute top-6 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap max-w-32 truncate border border-white/20"
                style={{ 
                  backgroundColor: cursor.color,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
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

            {/* Selection Highlight with better visibility */}
            {cursor.selection && (
              <div 
                className="absolute w-3 h-3 rounded-full animate-pulse border border-white/50"
                style={{ 
                  backgroundColor: cursor.color,
                  top: -6,
                  left: -6,
                  boxShadow: '0 0 8px rgba(0,0,0,0.3)'
                }}
              />
            )}

            {/* Debug indicator - remove in production */}
            {import.meta.env.DEV && (
              <div 
                className="absolute w-1 h-1 bg-red-500 rounded-full"
                style={{ top: 0, left: 0 }}
                title={`Debug: ${cursor.userId} at ${x},${y}`}
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