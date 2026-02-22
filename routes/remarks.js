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

// ===== ROUTE ADMIN ALL - Filtre archived + ajout isArchivable =====
router.get('/admin/all', optionalAuth, async (req, res) => {
  try {
    console.log('👑 GET /api/remarks/admin/all');
    const remarks = await Remark.find({ archived: false })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    console.log('✅ Remarques admin actives:', remarks.length);
    
    // Ajouter info archivable
    const remarksWithInfo = remarks.map(r => ({
      ...r.toObject(),
      isArchivable: r.isArchivable()
    }));
    
    res.json({
      success: true,
      count: remarks.length,
      data: remarksWithInfo
    });
  } catch (error) {
    console.error('❌ Erreur admin/all:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: error.message,
      data: []
    });
  }
});

// ===== DELETE ADMIN - Vérification isDeletable =====
router.delete('/admin/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🗑️  DELETE /api/remarks/admin/' + req.params.id);
    
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    // Vérifier si supprimable (archivée > 1 an)
    if (!remark.isDeletable()) {
      const daysSinceArchive = remark.archivedAt 
        ? Math.floor((Date.now() - remark.archivedAt) / (1000*60*60*24))
        : 0;
      
      return res.status(403).json({
        success: false,
        message: 'Suppression autorisée uniquement pour les remarques archivées depuis plus d\'un an',
        archived: remark.archived,
        archivedAt: remark.archivedAt,
        daysSinceArchive: daysSinceArchive
      });
    }

    // Supprimer photo
    if (remark.photoUrl) {
      const photoPath = path.join(__dirname, '..', remark.photoUrl);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log('📸 Photo supprimée');
      }
    }

    await remark.deleteOne();
    console.log('✅ Remarque supprimée (archivée > 1 an):', req.params.id);
    
    res.json({ success: true, message: 'Remarque supprimée' });
  } catch (error) {
    console.error('❌ Erreur DELETE admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// ===== GET ALL - Filtre archived =====
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/remarks');
    const remarks = await Remark.find({ archived: false })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    console.log('✅ Remarques actives:', remarks.length);
    
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
    
    const remark = await Remark.findById(req.params.id)
      .populate('user', 'name email');
    
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
router.post('/', optionalAuth, upload.single('photo'), async (req, res) => {
  try {
    console.log('📥 POST /api/remarks');
    console.log('   Body:', req.body);
    console.log('   File:', req.file ? req.file.filename : 'Aucune photo');
    console.log('   User:', req.user ? req.user.userId : 'Anonyme');

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

    if (req.user && req.user.userId) {
      remarkData.user = req.user.userId;
      console.log('👤 Remarque associée au user:', req.user.userId);
    }

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
    await remark.populate('user', 'name email');

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
    ).populate('user', 'name email');
    
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

// DELETE supprimer remarque (citoyens)
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
