require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const recordRoutes = require('./routes/recordRoutes');
const { router: hardwareRouter, setIo } = require('./routes/hardwareRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Models
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Pass io instance to hardware routes
setIo(io);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/hardware', hardwareRouter);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MediLink AI Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('join_doctor_room', (doctorId) => {
    socket.join(`doctor_${doctorId}`);
    console.log(`[Socket.io] Doctor ${doctorId} joined their room`);
  });
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Seed function - creates demo accounts if they don't exist
const seedDemoAccounts = async () => {
  try {
    const demoDoctor = await User.findOne({ email: 'doctor@medilink.com' });
    if (!demoDoctor) {
      const passwordHash = await bcrypt.hash('123456', 12);
      await User.create({
        name: 'Dr. Priya Sharma',
        email: 'doctor@medilink.com',
        passwordHash,
        role: 'doctor'
      });
      console.log('[Seed] Demo doctor created: doctor@medilink.com / 123456');
    }

    const demoPatient = await User.findOne({ email: 'patient@medilink.com' });
    if (!demoPatient) {
      const passwordHash = await bcrypt.hash('123456', 12);
      await User.create({
        name: 'Ramesh Kumar',
        email: 'patient@medilink.com',
        passwordHash,
        role: 'patient',
        patientId: 'MLP-26-000001',
        age: 65,
        bloodGroup: 'O+',
        allergies: ['Penicillin'],
        emergencyContact: {
          name: 'Sunita Kumar',
          phone: '+91-9876543210',
          relation: 'Spouse'
        }
      });
      console.log('[Seed] Demo patient created: patient@medilink.com / 123456 (ID: MLP-26-000001)');
    }

    const demoAdmin = await User.findOne({ email: 'admin@medilink.com' });
    if (!demoAdmin) {
      const passwordHash = await bcrypt.hash('123456', 12);
      await User.create({
        name: 'Admin User',
        email: 'admin@medilink.com',
        passwordHash,
        role: 'admin'
      });
      console.log('[Seed] Demo admin created: admin@medilink.com / 123456');
    }
  } catch (error) {
    console.error('[Seed] Error seeding demo accounts:', error.message);
  }
};

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medilink';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('[MongoDB] Connected to:', MONGO_URI);
    await seedDemoAccounts();
    httpServer.listen(PORT, () => {
      console.log(`[Server] MediLink AI Server running on http://localhost:${PORT}`);
      console.log(`[Server] Socket.io ready`);
      console.log(`[Server] Demo Accounts:`);
      console.log(`  Doctor:  doctor@medilink.com  / 123456`);
      console.log(`  Patient: patient@medilink.com / 123456`);
      console.log(`  Admin:   admin@medilink.com   / 123456`);
    });
  })
  .catch((error) => {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  });
