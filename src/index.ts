import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import merchantRoutes from './routes/merchant.routes';
import clientRoutes from './routes/client.routes';
import foodItemRoutes from './routes/foodItem.routes';
import orderRoutes from './routes/order.routes';
import { initializeWebSocket } from './services/websocket.service';
import { OrderCleanupService } from './services/orderCleanup.service';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize cleanup service
const orderCleanup = new OrderCleanupService();
orderCleanup.start();

// Configure CORS with specific options
const allowedOrigins = [
  'http://localhost:5173',          // Local merchant frontend
  'http://localhost:3000',          // Local development
  'https://sovy-merchant.netlify.app',  // Production merchant frontend (removed trailing slash)
  'https://sovy-mobile.expo.dev',   // Mobile app
  'https://sovy-backend.onrender.com'  // Production backend
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/food-items', foodItemRoutes);
app.use('/api/orders', orderRoutes);

// Initialize WebSocket server
initializeWebSocket(server);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle cleanup on server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  orderCleanup.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});