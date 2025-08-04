import React, { useEffect, useState } from 'react';
import { MousePointer, Crown, Edit, Eye, Shield } from 'lucide-react';

interface CursorData {
  userId: string;
  username: string;
  position: { x: number; y: number };
  color: string;
  role?: 'owner' | 'admin' | 'editor' | 'viewer';
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
        color: c.color,
        role: c.role
      })));
    }
  }, [activeCursors]);

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3 text-yellow-300" />;
      case 'admin': return <Shield className="w-3 h-3 text-purple-300" />;
      case 'editor': return <Edit className="w-3 h-3 text-blue-300" />;
      case 'viewer': return <Eye className="w-3 h-3 text-gray-300" />;
      default: return null;
    }
  };

  const getRoleColor = (role?: string): string => {
    switch (role) {
      case 'owner': return 'ring-2 ring-yellow-400/50';
      case 'admin': return 'ring-2 ring-purple-400/50';
      case 'editor': return 'ring-2 ring-blue-400/50';
      case 'viewer': return 'ring-2 ring-gray-400/50';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {activeCursors.map(cursor => {
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
            className="absolute transition-all duration-150 ease-out pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-2px, -2px)',
              zIndex: 9999
            }}
          >
            {/* Cursor Icon with enhanced visibility and role indicator */}
            <div className="relative">
              <div className={`relative ${getRoleColor(cursor.role)}`}>
                <MousePointer 
                  className="w-6 h-6 drop-shadow-lg filter"
                  style={{ 
                    color: cursor.color,
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))'
                  }}
                />
              </div>
              
              {/* Enhanced Username Label with role indicator */}
              <div 
                className="absolute top-7 left-3 px-3 py-1.5 rounded-lg text-sm font-semibold text-white shadow-xl whitespace-nowrap max-w-40 truncate border border-white/30 backdrop-blur-sm animate-fade-in"
                style={{ 
                  backgroundColor: cursor.color,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)'
                }}
              >
                <div className="flex items-center gap-1.5">
                  {getRoleIcon(cursor.role)}
                  <span>{cursor.username || 'Anonymous'}</span>
                </div>
                {cursor.selection && (
                  <div className="text-xs opacity-90 mt-0.5">
                    editing {cursor.selection.tableId}
                  </div>
                )}
              </div>

              {/* Floating role badge for owners/admins */}
              {(cursor.role === 'owner' || cursor.role === 'admin') && (
                <div 
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse"
                  style={{
                    backgroundColor: cursor.role === 'owner' ? '#FCD34D' : '#A855F7',
                  }}
                >
                  {getRoleIcon(cursor.role)}
                </div>
              )}
            </div>

            {/* Selection Highlight with enhanced visibility */}
            {cursor.selection && (
              <div 
                className="absolute w-4 h-4 rounded-full animate-ping border-2 border-white/60"
                style={{ 
                  backgroundColor: `${cursor.color}80`, // 50% opacity
                  top: -8,
                  left: -8,
                  boxShadow: `0 0 12px ${cursor.color}40`
                }}
              />
            )}

            {/* Activity indicator pulse */}
            <div 
              className="absolute w-2 h-2 rounded-full animate-pulse"
              style={{ 
                backgroundColor: cursor.color,
                top: 20,
                left: 20,
                opacity: 0.6
              }}
            />

            {/* Debug indicator - remove in production */}
            {import.meta.env.DEV && (
              <div 
                className="absolute w-1 h-1 bg-red-500 rounded-full"
                style={{ top: 0, left: 0 }}
                title={`Debug: ${cursor.userId} (${cursor.role}) at ${x},${y}`}
              />
            )}
          </div>
        );
      })}

      {/* Add custom CSS animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CollaborativeCursors;
export type { CursorData };