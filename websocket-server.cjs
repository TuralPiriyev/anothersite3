// WebSocket server for real-time collaboration
const express = require('express');
const http = require('http');
const cors = require('cors');

const PORT = process.env.WEBSOCKET_PORT || 5001;

console.log('🔧 WebSocket Server Configuration:');
console.log(`📡 Port: ${PORT}`);
console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

// Create HTTP server
const app = express();
app.use(cors());
const server = http.createServer(app);

// Set up express-ws
const expressWs = require('express-ws')(app, server);

// Store active connections by schema ID
const connections = new Map();
const userSessions = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Broadcast message to all users in a schema except sender
function broadcastToSchema(schemaId, message, excludeUserId = null) {
  const schemaConnections = connections.get(schemaId);
  if (!schemaConnections) {
    console.log(`[broadcastToSchema] Schema bağlantısı tapılmadı: ${schemaId}`);
    return;
  }

  const messageStr = JSON.stringify(message);
  console.log(`📤 [broadcastToSchema] Schema ${schemaId} üçün yayım:`, message.type, `(${schemaConnections.size} connections)`);
  console.log(`📤 [broadcastToSchema] Mesaj:`, messageStr);

  schemaConnections.forEach(ws => {
    console.log(`[broadcastToSchema] Bağlantı: userId=${ws.userId}, readyState=${ws.readyState}`);
    if (ws.readyState === 1 && ws.userId !== excludeUserId) { // 1 = OPEN
      try {
        ws.send(messageStr);
        console.log(`[broadcastToSchema] Mesaj göndərildi: userId=${ws.userId}`);
      } catch (error) {
        console.error('[broadcastToSchema] Müştəriyə mesaj göndərilməsində xəta:', error);
        cleanupConnection(ws, schemaId);
      }
    }
  });
}

// Clean up closed connections
function cleanupConnection(ws, schemaId) {
  const schemaConnections = connections.get(schemaId);
  if (schemaConnections) {
    schemaConnections.delete(ws);
    if (schemaConnections.size === 0) {
      connections.delete(schemaId);
    }
  }
  
  if (ws.userId) {
    userSessions.delete(ws.userId);
  }
}

// Express-ws route for collaboration
app.ws('/ws/collaboration/:schemaId', (ws, req) => {
  const schemaId = req.params.schemaId;
  
  if (!schemaId) {
    ws.close(1008, 'Schema ID required');
    return;
  }
  
  console.log(`✅ New WebSocket connection for schema: ${schemaId}`);
  
  // Add connection to schema group
  if (!connections.has(schemaId)) {
    connections.set(schemaId, new Set());
  }
  connections.get(schemaId).add(ws);
  
  ws.schemaId = schemaId;
  ws.isAlive = true;
  ws.connectedAt = Date.now();
  
  // Send connection established message with schema info
  ws.send(JSON.stringify({
    type: 'connection_established',
    clientId: `client_${Date.now()}`,
    schemaId: schemaId,
    timestamp: new Date().toISOString()
  }));
  
  // Send current users in schema
  const schemaConnections = connections.get(schemaId);
  if (schemaConnections) {
    const currentUsers = Array.from(schemaConnections)
      .filter(conn => conn.userId && conn.username)
      .map(conn => ({
        id: conn.userId,
        username: conn.username,
        role: conn.role || 'editor'
      }));
    
    if (currentUsers.length > 0) {
      ws.send(JSON.stringify({
        type: 'current_users',
        users: currentUsers
      }));
    }
  }
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 [WS] Mesaj alındı: schema=${schemaId}, type=${message.type}, data=`, message);
      switch (message.type) {
        case 'user_join':
          ws.userId = message.userId;
          ws.username = message.username;
          ws.role = message.role || 'editor';
          userSessions.set(message.userId, ws);
          console.log(`[WS] user_join: userId=${message.userId}, username=${message.username}, role=${ws.role}`);
          // Broadcast user joined to others
          broadcastToSchema(schemaId, {
            type: 'user_joined',
            user: {
              id: message.userId,
              username: message.username,
              role: ws.role,
              joinedAt: new Date().toISOString()
            }
          }, message.userId);
          break;
        case 'user_leave':
          console.log(`[WS] user_leave: userId=${message.userId}, username=${message.username}`);
          broadcastToSchema(schemaId, {
            type: 'user_left',
            userId: message.userId
          }, message.userId);
          break;
        case 'cursor_update':
          console.log(`[WS] cursor_update:`, message.cursor);
          if (message.cursor && typeof message.cursor === 'object' && message.cursor.userId && typeof message.cursor.userId === 'string') {
            const cursorData = {
              ...message.cursor,
              timestamp: new Date().toISOString()
            };
            console.log(`[WS] cursor_update yayılacaq:`, cursorData);
            broadcastToSchema(schemaId, {
              type: 'cursor_update',
              data: cursorData
            }, message.cursor.userId);
          } else {
            console.warn('[WS] cursor_update formatı səhvdir:', message);
          }
          break;
        case 'schema_change':
          console.log(`[WS] schema_change:`, message);
          if (!message.changeType || !message.data) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid schema_change format. Expected changeType and data.'
            }));
            break;
          }
          const schemaChangeMessage = {
            type: 'schema_change',
            changeType: message.changeType,
            data: message.data,
            userId: message.userId,
            username: message.username,
            timestamp: new Date().toISOString()
          };
          broadcastToSchema(schemaId, schemaChangeMessage, message.userId);
          break;
        case 'user_selection':
          console.log(`[WS] user_selection:`, message.data);
          broadcastToSchema(schemaId, {
            type: 'user_selection',
            data: message.data
          }, message.data?.userId);
          break;
        case 'presence_update':
          console.log(`[WS] presence_update:`, message.data);
          broadcastToSchema(schemaId, {
            type: 'presence_update',
            data: message.data
          }, message.data?.userId);
          break;
        case 'member_added':
          console.log(`[WS] member_added:`, message.data);
          broadcastToSchema(schemaId, {
            type: 'member_added',
            data: message.data
          });
          break;
        case 'ping':
          console.log(`[WS] ping:`, message);
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log(`[WS] Naməlum mesaj tipi: ${message.type}`, message);
      }
    } catch (error) {
      console.error('[WS] Mesaj işlənməsində xəta:', error, data);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    console.log(`❌ [WS] WebSocket bağlantısı bağlandı: schema=${schemaId}, userId=${ws.userId}`);
    // Notify other users
    if (ws.userId) {
      console.log(`[WS] user_left yayımı: userId=${ws.userId}`);
      broadcastToSchema(schemaId, {
        type: 'user_left',
        userId: ws.userId
      }, ws.userId);
    }
    cleanupConnection(ws, schemaId);
  });
  
  // Handle connection errors
  ws.on('error', (error) => {
    console.error('❌ [WS] WebSocket error:', error, `schema=${schemaId}, userId=${ws.userId}`);
    cleanupConnection(ws, schemaId);
  });
  
  // Heartbeat to detect broken connections
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// Portfolio updates WebSocket endpoint
app.ws('/ws/portfolio-updates', (ws, req) => {
  console.log('➿ Client subscribed to portfolio-updates');

  ws.on('message', msg => {
    // Broadcast updates to all portfolio clients
    expressWs.getWss().clients.forEach(client => {
      if (client !== ws && client.readyState === 1) { // 1 = OPEN
        client.send(msg);
      }
    });
  });

  ws.on('close', () => {
    console.log('❌ Portfolio-updates socket closed');
  });
});

// Heartbeat interval to clean up dead connections
const heartbeatInterval = setInterval(() => {
  console.log(`💓 Heartbeat check - Active schemas: ${connections.size}`);
  
  connections.forEach((schemaConnections, schemaId) => {
    schemaConnections.forEach(ws => {
      if (!ws.isAlive) {
        console.log(`💀 Terminating dead connection for schema: ${schemaId}, user: ${ws.username || ws.userId || 'unknown'}`);
        cleanupConnection(ws, schemaId);
        return ws.terminate();
      }
      
      // Reset alive flag and send ping
      ws.isAlive = false;
      
      // Only ping if connection is open
      if (ws.readyState === 1) { // 1 = OPEN
        try {
          ws.ping();
        } catch (error) {
          console.error(`❌ Error sending ping to ${ws.username || ws.userId}:`, error);
          cleanupConnection(ws, schemaId);
        }
      } else {
        // Connection is not open, clean it up
        console.log(`🧹 Cleaning up non-open connection (state: ${ws.readyState}) for schema: ${schemaId}`);
        cleanupConnection(ws, schemaId);
      }
    });
  });
}, 30000); // Check every 30 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down WebSocket server...');
  clearInterval(heartbeatInterval);
  
  connections.forEach((schemaConnections) => {
    schemaConnections.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });
  });
  
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 Real-time collaboration enabled`);
  console.log(`🔗 WebSocket endpoints:`);
  console.log(`   - ws://localhost:${PORT}/ws/collaboration/:schemaId`);
  console.log(`   - ws://localhost:${PORT}/ws/portfolio-updates`);
});

// Export for testing
module.exports = { server, connections, userSessions };
