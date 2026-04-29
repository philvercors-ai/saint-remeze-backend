# Saint-Remèze Backend v7.2.4

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

### v7.2.4
- Nouvelle route `PATCH /api/remarks/:id/edit` : correction d'une remarque par son auteur
  - Authentification obligatoire
  - Vérification de propriété (seul l'auteur peut modifier)
  - Modification autorisée uniquement si statut "En attente" ou "Vue"
  - Champs modifiables : titre, description, catégorie

### v7.2.3
- Archivage automatique des remarques terminées/rejetées (après 30 jours)
- Dashboard admin `/admin.html`
- Route `/api/archive`

### v7.2.2
- Upload multi-photos Cloudinary (jusqu'à 3 photos)
- Notifications citoyen lors des changements de statut
- Réinitialisation de mot de passe par email (Resend)
