const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// ============================
// POST /api/auth/register
// ============================
router.post('/register', async (req, res) => {
  try {
    console.log('📝 Tentative inscription:', req.body?.email);

    const { name, email, password, phone, rgpdConsent } = req.body;

    // Validation des champs obligatoires
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom, email et mot de passe sont obligatoires'
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer l'utilisateur
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone?.trim() || '',
      role: 'user',
      rgpdConsent: rgpdConsent || false,
      rgpdConsentDate: rgpdConsent ? new Date() : null
    });

    await user.save();
    console.log('✅ Utilisateur créé:', user.email);

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur inscription:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur: ' + error.message
    });
  }
});

// ============================
// POST /api/auth/login
// ============================
router.post('/login', async (req, res) => {
  try {
    console.log('🔑 Tentative connexion:', req.body?.email);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe obligatoires'
      });
    }

    // Trouver l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Connexion réussie:', user.email, '| Rôle:', user.role);

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur connexion:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur: ' + error.message
    });
  }
});

// ============================
// GET /api/auth/me
// ============================
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalide' });
  }
});

module.exports = router;
