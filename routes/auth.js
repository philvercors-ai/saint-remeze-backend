const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Resend } = require('resend');
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

// ============================
// POST /api/auth/forgot-password
// ============================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email obligatoire' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Réponse identique que l'email existe ou non (anti-énumération)
    const successResponse = {
      success: true,
      message: 'Si cet email est associé à un compte, vous recevrez un lien dans quelques minutes.'
    };

    if (!user) {
      console.log('⚠️  Forgot password - email inconnu:', email);
      return res.json(successResponse);
    }

    // Générer un token aléatoire de 32 octets
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Stocker le hash en base (on n'expose jamais le token brut)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    console.log('🔑 Token reset généré pour:', user.email);

    const frontendUrl = process.env.FRONTEND_URL || 'https://saint-remeze-pwa.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    // Envoi de l'email via Resend
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Saint-Remèze <onboarding@resend.dev>',
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe – Saint-Remèze',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: #2c5f8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Saint-Remèze</h1>
              <p style="color: #c8dff0; margin: 4px 0 0; font-size: 13px;">Application citoyenne</p>
            </div>
            <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="color: #1e293b; font-size: 16px;">Bonjour <strong>${user.name}</strong>,</p>
              <p style="color: #475569;">Vous avez demandé la réinitialisation de votre mot de passe.</p>
              <p style="color: #475569;">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}"
                   style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px;
                          text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 13px;">
                Ce lien est valable <strong>1 heure</strong>.<br>
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="color: #94a3b8; font-size: 11px; text-align: center;">
                Mairie de Saint-Remèze — Application citoyenne
              </p>
            </div>
          </div>
        `
      });

      console.log('✅ Email reset envoyé à:', user.email);
    } catch (emailError) {
      console.error('❌ Erreur envoi email:', emailError.message);
    }

    res.json(successResponse);

  } catch (error) {
    console.error('❌ Erreur forgot-password:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================
// POST /api/auth/reset-password/:token
// ============================
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Retrouver l'utilisateur via le hash du token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Lien invalide ou expiré. Veuillez refaire une demande.'
      });
    }

    // Mettre à jour le mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log('✅ Mot de passe réinitialisé pour:', user.email);

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });

  } catch (error) {
    console.error('❌ Erreur reset-password:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
