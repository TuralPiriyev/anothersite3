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

  // Filter out stale cursors (older than 30 seconds)
  const activeCursors = cursors.filter(cursor => {
    const lastSeenTime = cursor.lastSeen instanceof Date ? 
      cursor.lastSeen.getTime() : 
      new Date(cursor.lastSeen).getTime();
    const now = Date.now();
    return (now - lastSeenTime) < 30000; // 30 seconds
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {activeCursors.map(cursor => {
        // Ensure valid position before rendering
        const x = typeof cursor.position?.x === 'number' ? cursor.position.x : 0;
        const y = typeof cursor.position?.y === 'number' ? cursor.position.y : 0;
        
        // Skip rendering if position is invalid
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
          return null;
        }

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-100 ease-out pointer-events-none"
            style={{
              left: x,
              top: y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            {/* Cursor Icon */}
            <div className="relative">
              <MousePointer 
                className="w-5 h-5 drop-shadow-lg"
                style={{ color: cursor.color }}
              />
              
              {/* Username Label */}
              <div 
                className="absolute top-6 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap max-w-32 truncate"
                style={{ backgroundColor: cursor.color }}
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
                  left: -4
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