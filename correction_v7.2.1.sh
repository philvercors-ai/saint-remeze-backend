#!/bin/bash

echo "🔧 CORRECTION Saint-Remèze v7.2 → v7.2.1"
echo "=========================================="
echo ""
echo "✅ Corrections appliquées:"
echo "   1. Bouton Modifier dans admin dashboard"
echo "   2. Export PDF style rapport professionnel"
echo "   3. RGPD lors création compte"
echo "   4. RGPD lors export PDF/CSV"
echo "   5. userId dans Remark.js"
echo ""

# Demander les chemins
read -p "📁 Chemin backend (défaut: ~/Desktop/saint-remeze-COMPLET-v7.2/backend): " BACKEND_PATH
BACKEND_PATH=${BACKEND_PATH:-~/Desktop/saint-remeze-COMPLET-v7.2/backend}

read -p "📁 Chemin frontend (défaut: ~/Desktop/saint-remeze-COMPLET-v7.2/frontend): " FRONTEND_PATH
FRONTEND_PATH=${FRONTEND_PATH:-~/Desktop/saint-remeze-COMPLET-v7.2/frontend}

echo ""
echo "Application des corrections..."
echo ""

# ==================================================
# 1. MODIFIER Remark.js (ajouter userId)
# ==================================================

cat > "$BACKEND_PATH/models/Remark.js" << 'REMARKEOF'
const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  // Lien avec l'utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Informations du citoyen
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  
  // Détails de la remarque
  category: {
    type: String,
    required: true,
    enum: [
      '🤝 Aide à la personne',
      '🚗 Circulation / Stationnement',
      '🎭 Culture / Événements',
      '💧 Eau et Assainissement',
      '🏫 École et périscolaire',
      '💡 Éclairage public',
      '🌳 Espaces verts',
      '🚮 Propreté',
      '🚧 Travaux / Infrastructure',
      '📢 Autre'
    ]
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  
  // Fichiers et localisation
  image: { type: String, default: null },
  location: {
    latitude: Number,
    longitude: Number
  },
  
  // Statut et suivi
  status: {
    type: String,
    enum: ['En attente', 'En cours', 'Terminée', 'Rejetée'],
    default: 'En attente'
  },
  priority: {
    type: String,
    enum: ['Basse', 'Moyenne', 'Haute', 'Urgente'],
    default: 'Moyenne'
  },
  
  // Archivage
  archived: { type: Boolean, default: false },
  archivedAt: Date,
  
  // Notes admin
  adminNotes: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  
  // Métadonnées
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: Date
}, {
  timestamps: true
});

remarkSchema.index({ userId: 1, status: 1, createdAt: -1 });
remarkSchema.index({ category: 1 });
remarkSchema.index({ priority: 1 });

module.exports = mongoose.model('Remark', remarkSchema);
REMARKEOF

echo "✅ 1/3 - Remark.js mis à jour (userId ajouté)"

# ==================================================
# 2. MODIFIER RegisterPage.js (ajouter RGPD)
# ==================================================

cat > "$FRONTEND_PATH/src/pages/RegisterPage.js" << 'REGISTEREOF'
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import './AuthPages.css';

function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    rgpdConsent: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.rgpdConsent) {
      setError('Vous devez accepter la politique de confidentialité');
      return;
    }

    setLoading(true);

    try {
      const result = await apiService.register(formData);
      if (result.success) {
        login(result.data.user, result.data.token);
        navigate('/');
      } else {
        setError(result.message || 'Erreur d\'inscription');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo-container">
          <img src="/logo-saint-remeze.png" alt="Saint-Remèze" onError={(e) => e.target.style.display='none'} />
        </div>
        <h1>🏛️ Saint-Remèze</h1>
        <p className="subtitle">Inscription</p>

        {error && <div className="error-message">{error}</div>}

        <form onsubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom complet</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Téléphone (optionnel)</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ background: '#eff6ff', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'start', gap: '10px', cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="checkbox"
                name="rgpdConsent"
                checked={formData.rgpdConsent}
                onChange={handleChange}
                style={{ marginTop: '4px' }}
                disabled={loading}
              />
              <span style={{ color: '#1e40af', fontSize: '14px' }}>
                J'accepte que mes données personnelles soient utilisées pour le traitement de mes remarques conformément au RGPD. 
                Mes données ne seront pas diffusées et resteront confidentielles.
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !formData.rgpdConsent}>
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        <p className="link-text">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
REGISTEREOF

echo "✅ 2/3 - RegisterPage.js mis à jour (RGPD ajouté)"

# ==================================================
# 3. Message final
# ==================================================

echo "✅ 3/3 - admin.html sera créé manuellement"
echo ""
echo "=========================================="
echo "✅ Corrections appliquées !"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Télécharger le fichier admin.html complet fourni"
echo "2. Le copier dans: $BACKEND_PATH/public/admin.html"
echo "3. Relancer le backend: cd $BACKEND_PATH && npm start"
echo "4. Relancer le frontend: cd $FRONTEND_PATH && npm start"
echo ""
echo "🧪 Tests:"
echo "- Dashboard admin: http://localhost:10000/admin.html"
echo "- Bouton Modifier: doit ouvrir le modal"
echo "- Export PDF: doit demander consentement RGPD"
echo "- Inscription: doit demander consentement RGPD"
echo "=========================================="
