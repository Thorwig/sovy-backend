import WebSocket from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<string, AuthenticatedWebSocket[]>;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ server, path: '/orders' });
    this.clients = new Map();

    this.wss.on('connection', async (ws: AuthenticatedWebSocket, request) => {
      try {
        // Extract token from query string
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
          ws.close(1008, 'Token required');
          return;
        }

        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret!) as { userId: string; role: string };
        ws.userId = decoded.userId;
        ws.role = decoded.role;

        // Store client connection
        const userClients = this.clients.get(decoded.userId) || [];
        userClients.push(ws);
        this.clients.set(decoded.userId, userClients);

        ws.on('close', () => {
          // Remove client on disconnect
          const userClients = this.clients.get(decoded.userId) || [];
          const updatedClients = userClients.filter(client => client !== ws);
          
          if (updatedClients.length === 0) {
            this.clients.delete(decoded.userId);
          } else {
            this.clients.set(decoded.userId, updatedClients);
          }
        });

      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Authentication failed');
      }
    });
  }

  public broadcastOrderUpdate(userId: string, merchantId: string | null, data: any) {
    // Send to user
    this.sendToUser(userId, {
      type: 'ORDER_UPDATED',
      order: data
    });

    // If there's a merchant ID, send to merchant as well
    if (merchantId) {
      this.sendToUser(merchantId, {
        type: 'ORDER_UPDATED',
        order: data
      });
    }
  }

  private sendToUser(userId: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  }
}

let instance: WebSocketService | null = null;

export const initializeWebSocket = (server: Server) => {
  instance = new WebSocketService(server);
  return instance;
};

export const getWebSocketService = () => {
  if (!instance) {
    throw new Error('WebSocket service not initialized');
  }
  return instance;
};