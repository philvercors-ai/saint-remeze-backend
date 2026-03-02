const express = require('express');
const router = express.Router();
const Remark = require('../models/Remark');
const { optionalAuth } = require('../middleware/auth');

// ===== ROUTE : Lancer archivage automatique =====
router.post('/auto-archive', optionalAuth, async (req, res) => {
  try {
    console.log('🗄️  POST /api/archive/auto-archive');
    
    const result = await Remark.autoArchive();
    
    console.log('✅ Archivage automatique effectué');
    console.log('   Remarques archivées:', result.modifiedCount);
    
    res.json({
      success: true,
      message: `${result.modifiedCount} remarque(s) archivée(s)`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Erreur archivage auto:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur archivage automatique',
      error: error.message
    });
  }
});

// ===== ROUTE : Archiver une remarque manuellement =====
router.post('/archive/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🗄️  POST /api/archive/archive/' + req.params.id);
    
    const remark = await Remark.findById(req.params.id);
    
    if (!remark) {
      return res.status(404).json({
        success: false,
        message: 'Remarque non trouvée'
      });
    }
    
    if (!remark.isArchivable()) {
      return res.status(400).json({
        success: false,
        message: 'Cette remarque ne peut pas être archivée (statut ou délai non respecté)'
      });
    }
    
    await remark.archive();
    
    console.log('✅ Remarque archivée:', remark._id);
    
    res.json({
      success: true,
      message: 'Remarque archivée avec succès',
      remark
    });
  } catch (error) {
    console.error('❌ Erreur archivage:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ===== ROUTE : Désarchiver une remarque =====
router.post('/unarchive/:id', optionalAuth, async (req, res) => {
  try {
    console.log('📤 POST /api/archive/unarchive/' + req.params.id);
    
    const remark = await Remark.findByIdAndUpdate(
      req.params.id,
      {
        $set: { archived: false },
        $unset: { archivedAt: 1 }
      },
      { new: true }
    );
    
    if (!remark) {
      return res.status(404).json({
        success: false,
        message: 'Remarque non trouvée'
      });
    }
    
    console.log('✅ Remarque désarchivée:', remark._id);
    
    res.json({
      success: true,
      message: 'Remarque désarchivée avec succès',
      remark
    });
  } catch (error) {
    console.error('❌ Erreur désarchivage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur désarchivage',
      error: error.message
    });
  }
});

// ===== ROUTE : Liste des remarques archivées =====
router.get('/archived', optionalAuth, async (req, res) => {
  try {
    console.log('📋 GET /api/archive/archived');
    
    const remarks = await Remark.find({ archived: true })
      .populate('user', 'name email phone')
      .sort({ archivedAt: -1 });
    
    console.log('✅ Remarques archivées:', remarks.length);
    
    // Ajouter info supprimable
    const remarksWithInfo = remarks.map(r => ({
      ...r.toObject(),
      isDeletable: r.isDeletable(),
      daysSinceArchive: r.archivedAt ? Math.floor((Date.now() - r.archivedAt) / (1000 * 60 * 60 * 24)) : 0
    }));
    
    res.json({
      success: true,
      count: remarks.length,
      data: remarksWithInfo
    });
  } catch (error) {
    console.error('❌ Erreur liste archives:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur récupération archives',
      error: error.message
    });
  }
});

// ===== ROUTE : Stats archivage =====
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    console.log('📊 GET /api/archive/stats');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const stats = {
      archived: await Remark.countDocuments({ archived: true }),
      active: await Remark.countDocuments({ archived: false }),
      archivable: await Remark.countDocuments({
        archived: false,
        status: { $in: ['Terminée', 'Rejetée'] },
        updatedAt: { $lte: thirtyDaysAgo }
      }),
      deletable: await Remark.countDocuments({
        archived: true,
        archivedAt: { $lte: oneYearAgo }
      })
    };
    
    console.log('✅ Stats calculées:', stats);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur calcul stats',
      error: error.message
    });
  }
});

module.exports = router;
