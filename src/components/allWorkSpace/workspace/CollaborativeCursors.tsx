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

  // Debug log for cursor visibility
  useEffect(() => {
    if (activeCursors.length > 0) {
      console.log('🎯 Rendering cursors:', activeCursors.map(c => ({
        userId: c.userId,
        username: c.username,
        position: c.position,
        color: c.color
      })));
    }
  }, [activeCursors]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {activeCursors.map(cursor => {
        const x = typeof cursor.position?.x === 'number' && !isNaN(cursor.position.x) ? cursor.position.x : 0;
        const y = typeof cursor.position?.y === 'number' && !isNaN(cursor.position.y) ? cursor.position.y : 0;

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
            <MousePointer 
              className="w-5 h-5 drop-shadow-lg filter"
              style={{ 
                color: cursor.color,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
              }}
            />
            <div 
              className="absolute top-6 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap max-w-32 truncate border border-white/20"
              style={{ 
                backgroundColor: cursor.color,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {cursor.username || 'Anonymous'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CollaborativeCursors;
export type { CursorData };