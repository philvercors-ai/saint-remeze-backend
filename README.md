# Saint-Remèze Backend v7.2.10

## Installation
```bash
npm install
cp .env.example .env
# Modifier .env
npm start
```

Admin: admin@saint-remeze.fr / admin123
Dashboard: http://localhost:10000/admin

## Historique des versions

### v7.2.10
- Page d'accueil (index.html) : tuile Administration ajoutée pour accès direct au dashboard

### v7.2.9
- Nouvelle route `PATCH /api/remarks/:id/edit` : correction d'une remarque par son auteur
  - Authentification obligatoire
  - Vérification de propriété (seul l'auteur peut modifier)
  - Modification autorisée uniquement si statut "En attente" ou "Vue"
  - Champs modifiables : titre, description, catégorie

### v7.2.8
- Filtre temporel (Du / Au) sur l'export PDF et CSV
- Plage de dates affichée sur la page 1 du PDF
- Les exports respectent tous les filtres actifs (statut, recherche, dates)
- Bouton ↺ pour réinitialiser tous les filtres

### v7.2.3
- Correction export PDF/CSV : numéro de téléphone maintenant affiché
- Fix populate MongoDB : ajout du champ `phone` dans les requêtes admin

### v7.2.2
- Correction variable Vercel : REACT_APP_API_URL pointait sur le backend DEV
- Fix vercel.json : conflit headers + routes résolu
- Correction vulnérabilité sécurité Multer (v2.1.0)

### v7.2.1
- Ajout statut "Vue" pour les signalements consultés par l'admin
- Réinitialisation de mot de passe par email (token sécurisé)
- Support PWA (Progressive Web App) sur iOS et Android

### v7.2.0
- Mise en production PROD (Render + Vercel + MongoDB Atlas)
- Export PDF avec graphiques et export CSV complet
- Archivage automatique et suppression après 1 an
- Authentification JWT + rôles admin/user
- Upload photos via Cloudinary, géolocalisation GPS
