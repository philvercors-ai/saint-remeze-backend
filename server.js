const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// ── SÉCURITÉ : En-têtes HTTP ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cloudinary images
  contentSecurityPolicy: false // désactivé car admin.html charge des CDN externes
}));

// ── SÉCURITÉ : CORS restreint aux origines autorisées ────────────────────────
const allowedOrigins = [
  'https://saint-remeze-frontend.vercel.app',
  'http://localhost:3000'
];
app.use(cors({
  origin: (origin, callback) => {
    // Autorise les requêtes sans origin (Render admin.html, Postman, mobile PWA)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS non autorisé pour cette origine'));
  },
  credentials: true
}));

// ── SÉCURITÉ : Rate limiting ──────────────────────────────────────────────────
// Limite générale API
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, veuillez patienter.' }
}));

// Limite stricte sur les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' }
});
// Limite très stricte sur "mot de passe oublié" (anti-spam email)
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 heure
  max: 3,
  message: { success: false, message: 'Trop de demandes de réinitialisation, réessayez dans 1 heure.' }
});

app.use('/api/auth/login',            authLimiter);
app.use('/api/auth/register',         authLimiter);
app.use('/api/auth/forgot-password',  forgotLimiter);

// ── BODY PARSERS ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── FICHIERS STATIQUES ────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.redirect('/admin.html'));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/remarks',       require('./routes/remarks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/archive',       require('./routes/archive'));

// ── ARCHIVAGE AUTO ────────────────────────────────────────────────────────────
const Remark = require('./models/Remark');

(async () => {
  try {
    const result = await Remark.autoArchive();
    console.log('🗄️  Archivage auto au démarrage:', result.modifiedCount, 'remarque(s)');
  } catch (err) {
    console.error('❌ Erreur archivage auto:', err);
  }
})();

setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 2 && now.getMinutes() === 0) {
    try {
      const result = await Remark.autoArchive();
      console.log('🗄️  Archivage auto quotidien:', result.modifiedCount, 'remarque(s)');
    } catch (err) {
      console.error('❌ Erreur archivage auto:', err);
    }
  }
}, 60000);

// ── MONGODB ───────────────────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI non défini dans les variables d\'environnement !');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET non défini — tokens non sécurisés en production !');
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
    process.exit(1);
  });

// ── GESTION ERREURS ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message === 'CORS non autorisé pour cette origine') {
    return res.status(403).json({ success: false, message: err.message });
  }
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================');
  console.log('   Serveur Saint-Remèze v7.2.13 - Render');
  console.log('   ========================================');
  console.log('   🌐 Port:', PORT);
  console.log('   🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('   🔒 Helmet: actif');
  console.log('   🔒 CORS: restreint');
  console.log('   🔒 Rate limiting: actif');
  console.log('   ========================================');
});
