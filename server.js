require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();

// ===== CONFIGURATION CORS POUR PRODUCTION =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:10000',
  process.env.CORS_ORIGIN,  // URL Vercel depuis .env
  'https://saint-remeze.vercel.app',  // Remplacer par votre URL
  /\.vercel\.app$/  // Autoriser tous les previews Vercel
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check pour Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/remarks', require('./routes/remarks'));
app.use('/api/notifications', require('./routes/notifications'));

// Route racine API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API Saint-Remèze v7.2.3',
    version: '7.2.3',
    environment: process.env.NODE_ENV || 'development',
    features: ['Archivage automatique', 'Export PDF', 'Capture photo', 'Notifications'],
    endpoints: {
      auth: '/api/auth',
      remarks: '/api/remarks',
      notifications: '/api/notifications',
      admin: '/admin.html',
      health: '/health'
    }
  });
});

// Servir admin.html
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB Atlas');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Créer admin si n'existe pas
    const User = require('./models/User');
    const adminExists = await User.findOne({ email: 'admin@saint-remeze.fr' });
    
    if (!adminExists) {
      const admin = new User({
        name: 'Administrateur',
        email: 'admin@saint-remeze.fr',
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('👤 Compte admin créé');
      console.log('   ⚠️  CHANGEZ LE MOT DE PASSE ADMIN !');
    }
    
    // Lancer l'archivage automatique au démarrage (après 5 secondes)
    setTimeout(() => {
      autoArchiveOldRemarks();
    }, 5000);
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err.message);
    process.exit(1);
  });

// 🗄️ ARCHIVAGE AUTOMATIQUE
async function autoArchiveOldRemarks() {
  try {
    const Remark = require('./models/Remark');
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const result = await Remark.updateMany(
      {
        status: { $in: ['Terminée', 'Rejetée'] },
        updatedAt: { $lt: oneMonthAgo },
        archived: { $ne: true }
      },
      { $set: { archived: true } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🗄️  ${result.modifiedCount} remarque(s) archivée(s) automatiquement`);
    } else {
      console.log('🗄️  Archivage automatique : Aucune remarque à archiver');
    }
  } catch (error) {
    console.error('❌ Erreur archivage automatique:', error.message);
  }
}

// Cron job - Tous les jours à 3h du matin
cron.schedule('0 3 * * *', () => {
  console.log('⏰ Exécution archivage automatique quotidien...');
  autoArchiveOldRemarks();
});

// Serveur
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`   Serveur Saint-Remèze v7.2.3 démarré`);
  console.log('   ========================================');
  console.log(`   🌐 Port: ${PORT}`);
  console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  console.log(`   🗄️  Archivage automatique activé`);
  console.log('   ========================================');
  console.log('');
});

// Gestion des erreurs non gérées
process.on('unhandledRejection', (err) => {
  console.error('❌ Erreur non gérée:', err);
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu. Fermeture propre...');
  mongoose.connection.close(() => {
    console.log('MongoDB connexion fermée');
    process.exit(0);
  });
});
