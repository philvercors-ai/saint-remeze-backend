require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'admin@saint-remeze.fr';
const ADMIN_PASS  = 'admin123';
const ADMIN_NAME  = 'Administrateur';

async function createAdmin() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    console.log('   URI:', process.env.MONGODB_URI?.substring(0, 40) + '...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté');

    // Définir le modèle User directement
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
      name:            { type: String, required: true },
      email:           { type: String, required: true, unique: true, lowercase: true },
      password:        { type: String, required: true },
      phone:           { type: String, default: '' },
      role:            { type: String, enum: ['user', 'admin'], default: 'user' },
      rgpdConsent:     { type: Boolean, default: false },
      rgpdConsentDate: { type: Date, default: null }
    }, { timestamps: true }));

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASS, salt);

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      existing.role = 'admin';
      existing.password = hashedPassword;
      await existing.save();
      console.log('🔄 Admin mis à jour (mot de passe réinitialisé)');
    } else {
      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        rgpdConsent: true,
        rgpdConsentDate: new Date()
      });
      console.log('✅ Admin créé !');
    }

    console.log('   Email    :', ADMIN_EMAIL);
    console.log('   Password :', ADMIN_PASS);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
