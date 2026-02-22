const mongoose = require('mongoose');

const remarkSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'La catégorie est obligatoire']
  },
  title: {
    type: String,
    required: [true, 'Le titre est obligatoire']
  },
  description: {
    type: String,
    default: ''
  },
  photoUrl: {
    type: String
  },
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number]
    }
  },
  status: {
    type: String,
    enum: ['En attente', 'En cours', 'Terminée', 'Rejetée'],
    default: 'En attente'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: String
  },
  adminNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Index pour la géolocalisation
remarkSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Remark', remarkSchema);
