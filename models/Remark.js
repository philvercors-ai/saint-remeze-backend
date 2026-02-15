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
