const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

// Route racine - IMPORTANT pour éviter "Cannot GET /"
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'API Saint-Remèze',
    version: '7.2.3',
    status: 'running',
    endpoints: {
      remarks: '/api/remarks',
      auth: '/api/auth',
      admin: '/admin.html'
    }
  });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/remarks', require('./routes/remarks'));

// Connexion MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://philvercorsai:R3gVz74RBCiCgxY4@cluster0.5r9mq.mongodb.net/saint-remeze?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
    process.exit(1);
  });

// Gestion erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 pour routes non trouvées
app.use((req, res) => {
  console.log('⚠️  Route non trouvée:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================');
  console.log('   Serveur Saint-Remèze v7.2.3 - Render');
  console.log('   ========================================');
  console.log('   🌐 Port:', PORT);
  console.log('   🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('   📊 MongoDB:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
  console.log('   ========================================');
});
