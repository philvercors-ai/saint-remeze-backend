const express = require('express');
const router = express.Router();
const Remark = require('../models/Remark');
const Notification = require('../models/Notification');
const authUser = require('../middleware/authUser');
const authAdmin = require('../middleware/authAdmin');

// Créer une remarque
router.post('/', authUser, async (req, res) => {
  try {
    const { category, title, description, image, location } = req.body;
    const user = await require('../models/User').findById(req.userId);

    const remark = new Remark({
      userId: req.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      category,
      title,
      description,
      image,
      location
    });

    await remark.save();

    res.status(201).json({ success: true, data: remark });
  } catch (error) {
    console.error('Erreur création remarque:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer les remarques de l'utilisateur
router.get('/', authUser, async (req, res) => {
  try {
    const remarks = await Remark.find({ 
      userId: req.userId,
      archived: { $ne: true }
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: remarks });
  } catch (error) {
    console.error('Erreur récupération remarques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer une remarque par ID
router.get('/:id', authUser, async (req, res) => {
  try {
    const remark = await Remark.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    res.json({ success: true, data: remark });
  } catch (error) {
    console.error('Erreur récupération remarque:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ADMIN - Récupérer toutes les remarques
router.get('/admin/all', authAdmin, async (req, res) => {
  try {
    const remarks = await Remark.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: remarks });
  } catch (error) {
    console.error('Erreur récupération toutes remarques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ADMIN - Modifier une remarque (CORRIGÉ v7.2.2)
router.put('/admin/:id', authAdmin, async (req, res) => {
  try {
    const { status, priority, adminNotes, assignedTo } = req.body;
    const remark = await Remark.findById(req.params.id);

    if (!remark) {
      return res.status(404).json({ success: false, message: 'Remarque non trouvée' });
    }

    const oldStatus = remark.status;

    // Mettre à jour les champs modifiables
    if (priority !== undefined) remark.priority = priority;
    if (adminNotes !== undefined) remark.adminNotes = adminNotes;
    if (assignedTo !== undefined) remark.assignedTo = assignedTo;
    
    // Gérer le changement de statut
    if (status && status !== oldStatus) {
      remark.status = status;
      
      // Historique de statut
      if (!remark.statusHistory) {
        remark.statusHistory = [];
      }
      remark.statusHistory.push({
        status,
        changedAt: Date.now(),
        changedBy: req.user.name || 'Admin'
      });

      // ✅ CORRECTION : Créer notification SEULEMENT si userId existe
      if (remark.userId) {
        try {
          const notification = new Notification({
            userId: remark.userId,
            remarkId: remark._id,
            type: 'status_change',
            title: 'Changement de statut',
            message: `Votre remarque "${remark.title}" est maintenant : ${status}`
          });
          await notification.save();
          console.log('✅ Notification créée pour la remarque:', remark._id);
        } catch (notifError) {
          console.error('⚠️ Erreur création notification:', notifError.message);
          // Continue même si la notification échoue
        }
      } else {
        console.log('⚠️ Remarque sans userId, notification non créée');
      }
    }

    await remark.save();

    res.json({ success: true, data: remark });
  } catch (error) {
    console.error('❌ Erreur modification remarque:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur: ' + error.message 
    });
  }
});

module.exports = router;
