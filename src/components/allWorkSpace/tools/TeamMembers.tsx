import React, { useState, useEffect } from 'react';
import { 
  Users, Crown, Edit, Eye, Shield, Clock, Globe, 
  CheckCircle, AlertCircle, UserCheck, UserX, Wifi, WifiOff
} from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';
import { useAuth } from '../../../context/AuthContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { collaborationService } from '../../../services/collaborationService';

interface TeamMember {
  id: string;
  username: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'online' | 'away' | 'offline';
  joinedAt: Date;
  lastSeen?: Date;
  avatar?: string;
  color?: string;
  currentAction?: string;
  isApproved?: boolean;
  approvedAt?: Date;
}

interface TeamMembersProps {
  collapsed?: boolean;
}

const TeamMembers: React.FC<TeamMembersProps> = ({ collapsed = false }) => {
  const { currentSchema } = useDatabase();
  const { user } = useAuth();
  const { currentPlan } = useSubscription();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeMembers, setActiveMembers] = useState<Set<string>>(new Set());

  // Convert schema members to team members with enhanced data
  useEffect(() => {
    if (currentSchema?.members) {
      const enhancedMembers: TeamMember[] = currentSchema.members.map(member => ({
        id: member.id,
        username: member.username,
        role: member.role as 'owner' | 'admin' | 'editor' | 'viewer',
        status: activeMembers.has(member.id) ? 'online' : 'offline',
        joinedAt: member.joinedAt,
        lastSeen: member.lastSeen || new Date(),
        avatar: member.avatar,
        color: member.color || generateUserColor(member.username),
        currentAction: activeMembers.has(member.id) ? 'Working on schema' : 'Offline',
        isApproved: member.role === 'owner' || member.joinedAt < new Date(Date.now() - 1000), // Auto-approve existing members
        approvedAt: member.joinedAt
      }));
      setTeamMembers(enhancedMembers);
    }
  }, [currentSchema?.members, activeMembers]);

  // Listen for collaboration events to update member status
  useEffect(() => {
    const handleCollaborationEvent = (event: CustomEvent) => {
      const { type, data } = event.detail;
      
      switch (type) {
        case 'connection_status':
          setIsConnected(data.connected);
          break;
          
        case 'user_joined':
          if (data.userId) {
            setActiveMembers(prev => new Set([...prev, data.userId]));
            // Update member status
            setTeamMembers(prev => prev.map(member => 
              member.id === data.userId 
                ? { ...member, status: 'online', currentAction: 'Just joined', lastSeen: new Date() }
                : member
            ));
          }
          break;
          
        case 'user_left':
          if (data.userId) {
            setActiveMembers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.userId);
              return newSet;
            });
            // Update member status
            setTeamMembers(prev => prev.map(member => 
              member.id === data.userId 
                ? { ...member, status: 'offline', currentAction: 'Left workspace', lastSeen: new Date() }
                : member
            ));
          }
          break;
          
        case 'cursor_update':
          if (data.userId) {
            setActiveMembers(prev => new Set([...prev, data.userId]));
            // Update member activity
            setTeamMembers(prev => prev.map(member => 
              member.id === data.userId 
                ? { ...member, status: 'online', currentAction: 'Editing schema', lastSeen: new Date() }
                : member
            ));
          }
          break;

        case 'member_approved':
          // Handle when a new member is approved and joins the team
          if (data.memberId && data.username) {
            console.log('👤 New member approved:', data.username, 'with role:', data.role);
            setTeamMembers(prev => {
              // Check if member already exists
              const existingMember = prev.find(m => m.id === data.memberId || m.username === data.username);
              if (existingMember) {
                // Update existing member
                return prev.map(member => 
                  (member.id === data.memberId || member.username === data.username)
                    ? { 
                        ...member, 
                        isApproved: true, 
                        approvedAt: new Date(data.approvedAt),
                        status: 'online',
                        currentAction: 'Just joined the team'
                      }
                    : member
                );
              } else {
                // Add new member
                const newMember: TeamMember = {
                  id: data.memberId,
                  username: data.username,
                  role: data.role as 'owner' | 'admin' | 'editor' | 'viewer',
                  status: 'online',
                  joinedAt: new Date(),
                  lastSeen: new Date(),
                  color: generateUserColor(data.username),
                  currentAction: 'Just joined the team',
                  isApproved: true,
                  approvedAt: new Date(data.approvedAt)
                };
                return [...prev, newMember];
              }
            });
            setActiveMembers(prev => new Set([...prev, data.memberId]));
          }
          break;

        case 'member_removed':
          // Handle when a member is removed from the team
          if (data.memberId) {
            console.log('👤 Member removed:', data.username);
            setTeamMembers(prev => prev.filter(member => member.id !== data.memberId));
            setActiveMembers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.memberId);
              return newSet;
            });
          }
          break;

        case 'invitation_sent':
          // Handle when an invitation is sent (optional: show pending invitations)
          if (data.inviteeUsername) {
            console.log('📨 Invitation sent to:', data.inviteeUsername, 'with role:', data.role);
            // Could add pending member to list with special status
          }
          break;

        case 'presence_update':
          // Handle presence updates from other users
          if (data.userId && data.status) {
            setTeamMembers(prev => prev.map(member => 
              member.id === data.userId 
                ? { 
                    ...member, 
                    status: data.status,
                    currentAction: data.currentAction || member.currentAction,
                    lastSeen: new Date()
                  }
                : member
            ));
          }
          break;

        case 'member_status_update':
          // Handle direct member status updates
          if (data.memberId) {
            setTeamMembers(prev => prev.map(member => 
              member.id === data.memberId 
                ? { ...member, ...data }
                : member
            ));
          }
          break;
      }
    };

    window.addEventListener('collaboration-event', handleCollaborationEvent as EventListener);
    
    return () => {
      window.removeEventListener('collaboration-event', handleCollaborationEvent as EventListener);
    };
  }, []);

  // Generate consistent color for user
  const generateUserColor = (username: string): string => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-purple-500" />;
      case 'editor': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'editor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="w-3 h-3 text-green-500" />;
      case 'away': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'offline': return <WifiOff className="w-3 h-3 text-gray-400" />;
      default: return <WifiOff className="w-3 h-3 text-gray-400" />;
    }
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Only show for Ultimate plan users
  if (currentPlan !== 'ultimate') {
    return collapsed ? (
      <div className="p-4 text-center">
        <Users className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <p className="text-xs text-gray-500">Ultimate</p>
      </div>
    ) : (
      <div className="p-4 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Team Members
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          View and manage team members in real-time
        </p>
        <button className="text-xs px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium">
          Upgrade to Ultimate
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            {isConnected && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
            )}
          </div>
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {teamMembers.filter(m => m.status === 'online').length}
          </span>
          <div className="flex flex-col gap-1">
            {teamMembers.slice(0, 3).map(member => (
              <div
                key={member.id}
                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: member.color }}
                title={`${member.username} (${member.role})`}
              >
                {member.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {teamMembers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                +{teamMembers.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Team Members
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Wifi className="w-3 h-3" />
                <span>Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} • {teamMembers.filter(m => m.status === 'online').length} online
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        {teamMembers.length === 0 ? (
          <div className="p-4 text-center">
            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No team members yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Invite colleagues to collaborate
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {teamMembers
              .sort((a, b) => {
                // Sort by: online status, then role priority, then name
                if (a.status === 'online' && b.status !== 'online') return -1;
                if (b.status === 'online' && a.status !== 'online') return 1;
                
                const roleOrder = { owner: 0, admin: 1, editor: 2, viewer: 3 };
                const aRole = roleOrder[a.role] ?? 4;
                const bRole = roleOrder[b.role] ?? 4;
                if (aRole !== bRole) return aRole - bRole;
                
                return a.username.localeCompare(b.username);
              })
              .map(member => (
                <div
                  key={member.id}
                  className={`p-3 rounded-xl border transition-all duration-200 ${
                    member.status === 'online'
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white shadow-sm"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      {/* Status indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5">
                        {getStatusIcon(member.status)}
                      </div>
                    </div>

                    {/* Member info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.username}
                        </span>
                        {member.username === user?.username && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                        {member.isApproved && (
                          <UserCheck className="w-3 h-3 text-green-500" title="Approved member" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(member.role)}`}>
                            {member.role}
                          </span>
                        </div>
                      </div>
                      
                      {/* Current action or last seen */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {member.status === 'online' ? (
                          <span className="text-green-600 dark:text-green-400">
                            {member.currentAction || 'Online'}
                          </span>
                        ) : (
                          <span>Last seen {formatLastSeen(member.lastSeen || member.joinedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {teamMembers.filter(m => m.status === 'online').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {teamMembers.filter(m => m.isApproved).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Approved</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {teamMembers.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamMembers;