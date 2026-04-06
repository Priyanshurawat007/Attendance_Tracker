const express = require('express');
const cors = require('cors');

const app = express();

// ✅ USE AN ARRAY FOR MULTIPLE ORIGINS
const allowedOrigins = [
  'https://jununattendancemaker.vercel.app',
  'http://localhost:5173', // Vite default port
  'http://localhost:3000'  // CRA default port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Added OPTIONS for preflight
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'] // Explicitly allow Auth headers
}));

app.use(express.json());

// Your routes
app.use('/api', require('./routes'));

module.exports = app;