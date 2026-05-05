const express = require('express');
const router = express.Router();
const Remark = require('../models/Remark');
const auth = require('../middleware/auth');
const { optionalAuth } = auth;
const multer = require('multer');
const { storage, cloudinary } = require('../config/cloudinary');
const { sendStatusChangeEmail } = require('../utils/email');

// Configuration Multer avec Cloudinary Storage
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// GET /admin/all
router.get('/admin/all', optionalAuth, async (req, res) => {
  try {
    console.log('👑 GET /api/remarks/admin/all');
    const remarks = await Remark.find({ archived: false })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });
    
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

// DELETE /admin/:id
router.delete('/admin/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🗑️  DELETE /api/remarks/admin/' + req.params.id);
    
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

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

    if (remark.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(remark.cloudinaryPublicId);
        console.log('📸 Photo Cloudinary supprimée:', remark.cloudinaryPublicId);
      } catch (err) {
        console.error('Erreur suppression Cloudinary:', err);
      }
    }

    // Supprimer toutes les photos du tableau photos[]
    if (remark.photos && remark.photos.length > 0) {
      for (const photo of remark.photos) {
        if (photo.publicId) {
          try {
            await cloudinary.uploader.destroy(photo.publicId);
          } catch (err) {
            console.error('Erreur suppression Cloudinary photo:', err);
          }
        }
      }
    }

    await remark.deleteOne();
    console.log('✅ Remarque supprimée:', req.params.id);

    res.json({ success: true, message: 'Remarque supprimée' });
  } catch (error) {
    console.error('❌ Erreur DELETE admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET /
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/remarks');

    // Filtrer par utilisateur connecté si authentifié
    const query = { archived: false };
    if (req.user && req.user.userId) {
      query.user = req.user.userId;
      console.log('👤 Filtrage pour user:', req.user.userId);
    }

    const remarks = await Remark.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(remarks);
  } catch (error) {
    console.error('❌ Erreur GET remarks:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET /:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/remarks/' + req.params.id);
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }
    
    const remark = await Remark.findById(req.params.id)
      .populate('user', 'name email phone');
    
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    
    res.json(remark);
  } catch (error) {
    console.error('❌ Erreur GET remark by ID:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// ✅ POST / (CORRECTION : optionalAuth AVANT upload.single)
router.post('/', optionalAuth, upload.array('photos', 3), async (req, res) => {
  try {
    console.log('📥 POST /api/remarks');
    console.log('   User authentifié:', req.user ? req.user.userId : 'Aucun (anonyme)');
    console.log('   Body:', req.body);
    console.log('   File:', req.file ? 'Photo uploadée sur Cloudinary' : 'Pas de photo');

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
      status: 'En attente'
    };

    // ✅ CORRECTION : Association user
    if (req.user && req.user.userId) {
      remarkData.user = req.user.userId;
      console.log('👤 Remarque associée au user:', req.user.userId);
    } else {
      console.log('⚠️  Pas de user authentifié, remarque anonyme');
    }

    // Photos uploadées sur Cloudinary (jusqu'à 3)
    if (req.files && req.files.length > 0) {
      remarkData.photos = req.files.map(f => ({ url: f.path, publicId: f.filename }));
      // Compat backward : première photo dans photoUrl
      remarkData.photoUrl = req.files[0].path;
      remarkData.cloudinaryPublicId = req.files[0].filename;
      console.log('📸 Photos Cloudinary:', req.files.length, 'fichier(s)');
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
    
    // ✅ Populate user pour le retour
    await remark.populate('user', 'name email phone');

    console.log('✅ Remarque créée:', remark._id);
    console.log('   User associé:', remark.user ? remark.user.name : 'Aucun');

    res.status(201).json({ 
      success: true, 
      message: 'Remarque créée avec succès',
      remark 
    });

  } catch (error) {
    console.error('❌ Erreur POST remark:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur création remarque',
      error: error.message 
    });
  }
});

// PUT /:id
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('📝 PUT /api/remarks/' + req.params.id);

    const oldRemark = await Remark.findById(req.params.id);
    if (!oldRemark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }
    const oldStatus = oldRemark.status;

    const remark = await Remark.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email phone');

    // Créer une notification si le statut a changé
    console.log('🔔 Vérif notification - oldStatus:', oldStatus, '→ newStatus:', req.body.status);
    console.log('🔔 remark.user:', remark.user ? remark.user._id : 'NULL');
    if (req.body.status && req.body.status !== oldStatus && remark.user) {
      try {
        const Notification = require('../models/Notification');
        const statusLabels = {
          'En attente': 'en attente',
          'Vue': 'prise en compte par l\'administration',
          'En cours': 'en cours de traitement',
          'Terminée': 'terminée',
          'Rejetée': 'rejetée'
        };
        const label = statusLabels[req.body.status] || req.body.status;
        const notif = await Notification.create({
          userId: remark.user._id,
          type: 'status_change',
          title: `Mise à jour : ${remark.title}`,
          message: `Votre signalement "${remark.title}" est maintenant ${label}.`,
          remarkId: remark._id,
          read: false
        });
        console.log('🔔 ✅ Notification créée:', notif._id, 'pour user:', remark.user._id);
        await sendStatusChangeEmail(remark.user, remark, req.body.status);
      } catch (notifError) {
        console.error('❌ Erreur création notification:', notifError.message);
      }
    } else {
      console.log('⚠️ Notification non créée - statusChange:', req.body.status !== oldStatus, '- userPresent:', !!remark.user);
    }

    console.log('✅ Remarque mise à jour:', remark._id);
    res.json({ success: true, remark });
  } catch (error) {
    console.error('❌ Erreur PUT remark:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// PATCH /:id/view - Marquer comme Vue quand l'admin ouvre la remarque
router.patch('/:id/view', optionalAuth, async (req, res) => {
  try {
    const remark = await Remark.findById(req.params.id).populate('user', 'name email phone');
    if (!remark) return res.status(404).json({ success: false, message: 'Remarque non trouvée' });

    if (remark.status !== 'En attente') {
      return res.json({ success: true, remark, changed: false });
    }

    remark.status = 'Vue';
    await remark.save();

    if (remark.user) {
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          userId: remark.user._id,
          type: 'status_change',
          title: `Signalement pris en compte`,
          message: `Votre signalement "${remark.title}" a été vu et pris en compte par l'administration.`,
          remarkId: remark._id,
          read: false
        });
        await sendStatusChangeEmail(remark.user, remark, 'Vue');
      } catch (notifError) {
        console.error('❌ Erreur notification vue:', notifError.message);
      }
    }

    console.log('👁️  Remarque marquée Vue:', remark._id);
    res.json({ success: true, remark, changed: true });
  } catch (error) {
    console.error('❌ Erreur PATCH view:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// PATCH /:id/edit — Correction par le citoyen propriétaire
router.patch('/:id/edit', auth, async (req, res) => {
  try {
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    if (!remark.user || remark.user.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Action non autorisée' });
    }

    if (!['En attente', 'Vue'].includes(remark.status)) {
      return res.status(403).json({
        success: false,
        message: 'Cette remarque ne peut plus être modifiée car elle est en cours de traitement'
      });
    }

    const { title, description, category } = req.body;
    if (!title?.trim() || !category) {
      return res.status(400).json({ success: false, message: 'Titre et catégorie sont obligatoires' });
    }

    remark.title = title.trim();
    remark.description = description?.trim() || '';
    remark.category = category;
    await remark.save();
    await remark.populate('user', 'name email phone');

    console.log('✅ Remarque modifiée par le citoyen:', remark._id);
    res.json({ success: true, remark });
  } catch (error) {
    console.error('❌ Erreur PATCH edit:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /:id
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🗑️  DELETE /api/remarks/' + req.params.id);
    
    const remark = await Remark.findById(req.params.id);
    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    if (remark.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(remark.cloudinaryPublicId);
        console.log('📸 Photo Cloudinary supprimée');
      } catch (err) {
        console.error('Erreur suppression Cloudinary:', err);
      }
    }

    // Supprimer toutes les photos du tableau photos[]
    if (remark.photos && remark.photos.length > 0) {
      for (const photo of remark.photos) {
        if (photo.publicId) {
          try {
            await cloudinary.uploader.destroy(photo.publicId);
          } catch (err) {
            console.error('Erreur suppression Cloudinary photo:', err);
          }
        }
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
