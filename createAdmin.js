/**
 * Script de création de l'utilisateur admin
 * Exécuter UNE SEULE FOIS avec : node createAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://philvercorsai:R3gVz74RBCiCgxY4@cluster0.5r9mq.mongodb.net/saint-remeze?retryWrites=true&w=majority&appName=Cluster0';

// ⚙️ MODIFIE CES VALEURS AVANT D'EXÉCUTER
const ADMIN_NAME  = 'Administrateur';
const ADMIN_EMAIL = 'admin@saint-remeze.fr';
const ADMIN_PASS  = 'Admin2026!';  // ← change ce mot de passe !

const userSchema = new mongoose.Schema({
  name:            { type: String, required: true },
  email:           { type: String, required: true, unique: true, lowercase: true },
  password:        { type: String, required: true },
  phone:           { type: String, default: '' },
  role:            { type: String, enum: ['user', 'admin'], default: 'user' },
  rgpdConsent:     { type: Boolean, default: false },
  rgpdConsentDate: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté');

    // Vérifier si l'admin existe déjà
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log('🔄 Utilisateur existant promu admin:', ADMIN_EMAIL);
      } else {
        console.log('ℹ️  Admin déjà existant:', ADMIN_EMAIL);
      }
      process.exit(0);
    }

    // Créer le nouvel admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASS, salt);

    const admin = new User({
      name:        ADMIN_NAME,
      email:       ADMIN_EMAIL,
      password:    hashedPassword,
      phone:       '',
      role:        'admin',
      rgpdConsent: true,
      rgpdConsentDate: new Date()
    });

    await admin.save();
    console.log('✅ Admin créé avec succès !');
    console.log('   Email    :', ADMIN_EMAIL);
    console.log('   Password :', ADMIN_PASS);
    console.log('   Role     :', admin.role);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté');
    process.exit(0);
  }
}

createAdmin();
