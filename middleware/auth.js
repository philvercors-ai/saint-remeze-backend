const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_temporaire';

// Authentification obligatoire
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

// Authentification optionnelle (continue même sans token valide)
const optionalAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      req.user = jwt.verify(token, JWT_SECRET);
    }
  } catch (_) {
    // Silencieux — pas de token ou token invalide, on continue sans user
  }
  next();
};

// Authentification admin obligatoire (auth + rôle admin)
const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé à l\'administration'
      });
    }
    next();
  });
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.adminAuth = adminAuth;
