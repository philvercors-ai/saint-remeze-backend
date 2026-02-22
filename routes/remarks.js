const express = require('express');
const router = express.Router();
const Remark = require('../models/Remark');
const { optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration multer
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
  limits: { fileSize: 10 * 1024 * 1024 },
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

// ===== ROUTE ADMIN - TOUTES LES REMARQUES =====
router.get('/admin/all', optionalAuth, async (req, res) => {
  try {
    console.log('👑 GET /api/remarks/admin/all');
    const remarks = await Remark.find().sort({ createdAt: -1 });
    console.log('✅ Remarques admin:', remarks.length);
    
    res.json({
      success: true,
      count: remarks.length,
      remarks: remarks
    });
  } catch (error) {
    console.error('❌ Erreur admin/all:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// ===== ROUTE ADMIN - STATS =====
router.get('/admin/stats', optionalAuth, async (req, res) => {
  try {
    console.log('📊 GET /api/remarks/admin/stats');
    const remarks = await Remark.find();
    
    const stats = {
      total: remarks.length,
      byStatus: {
        'En attente': remarks.filter(r => r.status === 'En attente').length,
        'En cours': remarks.filter(r => r.status === 'En cours').length,
        'Terminée': remarks.filter(r => r.status === 'Terminée').length,
        'Rejetée': remarks.filter(r => r.status === 'Rejetée').length
      },
      byCategory: {}
    };
    
    // Compter par catégorie
    remarks.forEach(r => {
      stats.byCategory[r.category] = (stats.byCategory[r.category] || 0) + 1;
    });
    
    console.log('✅ Stats calculées');
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET toutes les remarques (citoyens)
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/remarks');
    const remarks = await Remark.find().sort({ createdAt: -1 });
    console.log('✅ Remarques trouvées:', remarks.length);
    
    res.json(remarks);
  } catch (error) {
    console.error('❌ Erreur GET remarks:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET remarque par ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/remarks/' + req.params.id);
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ ID invalide:', req.params.id);
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }
    
    const remark = await Remark.findById(req.params.id);
    
    if (!remark) {
      console.log('❌ Remarque non trouvée:', req.params.id);
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    
    console.log('✅ Remarque trouvée:', remark._id);
    res.json(remark);
  } catch (error) {
    console.error('❌ Erreur GET remark by ID:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// POST nouvelle remarque
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    console.log('📥 POST /api/remarks');
    console.log('   Body:', req.body);
    console.log('   File:', req.file ? req.file.filename : 'Aucune photo');

    const { category, title, description, latitude, longitude } = req.body;

    if (!category || !title) {
      console.log('❌ Validation: catégorie ou titre manquant');
      return res.status(400).json({ 
        success: false, 
        message: 'Catégorie et titre sont obligatoires' 
      });
    }

    const remarkData = {
      category,
      title,
      description: description || '',
      status: 'En attente'
    };

    if (req.file) {
      remarkData.photoUrl = '/uploads/' + req.file.filename;
      console.log('📸 Photo:', remarkData.photoUrl);
    }

    if (latitude && longitude) {
      remarkData.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      console.log('📍 Localisation:', remarkData.location.coordinates);
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
    console.error('❌ Erreur POST remark:', error);
    
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Erreur suppression fichier:', e);
      }
    }

    res.status(500).json({ 
      success: false, 
      message: 'Erreur création remarque',
      error: error.message 
    });
  }
});

// PUT mettre à jour remarque
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('📝 PUT /api/remarks/' + req.params.id);
    console.log('   Update:', req.body);
    
    const remark = await Remark.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    
    console.log('✅ Remarque mise à jour:', remark._id);
    res.json({ success: true, remark });
  } catch (error) {
    console.error('❌ Erreur PUT remark:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// DELETE supprimer remarque
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🗑️  DELETE /api/remarks/' + req.params.id);
    
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    if (remark.photoUrl) {
      const photoPath = path.join(__dirname, '..', remark.photoUrl);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log('📸 Photo supprimée');
      }
    }

    await remark.deleteOne();
    console.log('✅ Remarque supprimée:', req.params.id);
    
    res.json({ success: true, message: 'Remarque supprimée' });
  } catch (error) {
    console.error('❌ Erreur DELETE remark:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;
