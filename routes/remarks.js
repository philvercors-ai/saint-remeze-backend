const express = require('express');
const router = express.Router();
const Remark = require('../models/Remark');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration multer pour upload photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'remark-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// GET toutes les remarques
router.get('/', auth, async (req, res) => {
  try {
    const remarks = await Remark.find().sort({ createdAt: -1 });
    res.json(remarks);
  } catch (error) {
    console.error('Erreur récupération remarques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST nouvelle remarque (avec photo optionnelle)
router.post('/', auth, upload.single('photo'), async (req, res) => {
  try {
    console.log('📥 Données reçues:', req.body);
    console.log('📸 Fichier reçu:', req.file);

    const { category, title, description, latitude, longitude } = req.body;

    if (!category || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Catégorie et titre sont obligatoires' 
      });
    }

    const remarkData = {
      category,
      title,
      description: description || '',
      user: req.user.userId,
      status: 'En attente'
    };

    // Ajouter la photo si présente
    if (req.file) {
      remarkData.photoUrl = '/uploads/' + req.file.filename;
    }

    // Ajouter la localisation si présente
    if (latitude && longitude) {
      remarkData.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
    }

    const remark = new Remark(remarkData);
    await remark.save();

    console.log('✅ Remarque créée:', remark._id);

    res.status(201).json({ 
      success: true, 
      message: 'Remarque créée avec succès',
      remark 
    });

  } catch (error) {
    console.error('❌ Erreur création remarque:', error);
    
    // Supprimer le fichier uploadé en cas d'erreur
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de la remarque',
      error: error.message 
    });
  }
});

// GET remarque par ID
router.get('/:id', auth, async (req, res) => {
  try {
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    res.json(remark);
  } catch (error) {
    console.error('Erreur récupération remarque:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT mettre à jour remarque
router.put('/:id', auth, async (req, res) => {
  try {
    const remark = await Remark.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    res.json({ success: true, remark });
  } catch (error) {
    console.error('Erreur mise à jour remarque:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE supprimer remarque
router.delete('/:id', auth, async (req, res) => {
  try {
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    // Supprimer la photo si elle existe
    if (remark.photoUrl) {
      const photoPath = path.join(__dirname, '..', remark.photoUrl);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await remark.deleteOne();
    res.json({ success: true, message: 'Remarque supprimée' });
  } catch (error) {
    console.error('Erreur suppression remarque:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
