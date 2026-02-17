require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();

// ===== CONFIGURATION CORS =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:10000',
  process.env.CORS_ORIGIN,
  /\.vercel\.app$/,
  /\.onrender\.com$/
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
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

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== HEALTH CHECK (utilisé aussi par Render pour vérifier le service) =====
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '7.2.3'
  });
});

// ===== ROUTES API =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/remarks', require('./routes/remarks'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API Saint-Remèze v7.2.3',
    version: '7.2.3',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/admin', (req, res) => res.redirect('/admin.html'));

// ===== CONNEXION MONGODB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB Atlas');

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
    }

    setTimeout(autoArchiveOldRemarks, 5000);
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err.message);
    process.exit(1);
  });

// ===== ARCHIVAGE AUTOMATIQUE =====
async function autoArchiveOldRemarks() {
  try {
    const Remark = require('./models/Remark');
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const result = await Remark.updateMany(
      { status: { $in: ['Terminée', 'Rejetée'] }, updatedAt: { $lt: oneMonthAgo }, archived: { $ne: true } },
      { $set: { archived: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`🗄️  ${result.modifiedCount} remarque(s) archivée(s)`);
    }
  } catch (error) {
    console.error('❌ Erreur archivage:', error.message);
  }
}

cron.schedule('0 3 * * *', autoArchiveOldRemarks);

// ===== KEEP-ALIVE RENDER FREE (évite la mise en veille) =====
// Render Free met le service en veille après 15min d'inactivité
// Ce ping interne toutes les 14 min garde le service actif
if (process.env.NODE_ENV === 'production') {
  const http = require('http');
  setInterval(() => {
    const PORT_PING = process.env.PORT || 10000;
    http.get(`http://localhost:${PORT_PING}/health`, (res) => {
      console.log(`♻️  Keep-alive ping - Status: ${res.statusCode}`);
    }).on('error', () => {});
  }, 14 * 60 * 1000); // 14 minutes
}

// ===== DÉMARRAGE =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('   Serveur Saint-Remèze v7.2.3 - Render');
  console.log('   ========================================');
  console.log(`   🌐 Port: ${PORT}`);
  console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  console.log('   ========================================');
  console.log('');
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Erreur non gérée:', err.message);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
