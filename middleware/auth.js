const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise' 
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt_temporaire');
    
    // Ajouter les infos utilisateur à la requête
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Erreur auth:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Token invalide ou expiré' 
    });
  }
};

// Middleware optionnel (continue même sans auth)
const optionalAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt_temporaire');
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue sans authentification
    next();
  }
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
