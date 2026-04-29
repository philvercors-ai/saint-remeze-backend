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

// Route racine → Portail citoyen
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route admin - Redirection vers admin.html
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/remarks', require('./routes/remarks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/archive', require('./routes/archive'));

// ===== TÂCHE CRON : Archivage automatique quotidien =====
// Optionnel : Si vous voulez archiver automatiquement tous les jours

const Remark = require('./models/Remark');

// Lancer archivage au démarrage
(async () => {
  try {
    const result = await Remark.autoArchive();
    console.log('🗄️  Archivage auto au démarrage:', result.modifiedCount, 'remarque(s)');
  } catch (err) {
    console.error('❌ Erreur archivage auto:', err);
  }
})();

// Archivage quotidien (à 2h du matin)
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
}, 60000); // Vérifier chaque minute




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
  console.log('   Serveur Saint-Remèze v7.2.9 - Render');
  console.log('   ========================================');
  console.log('   🌐 Port:', PORT);
  console.log('   🌍 Environment:', process.env.NODE_ENV || 'production');
  console.log('   📊 MongoDB:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
  console.log('   ========================================');
});
