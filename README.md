# Saint-Remèze Backend v7.2.11

## Installation
```bash
npm install
cp .env.example .env
# Modifier .env
npm start
```

Admin: admin@saint-remeze.fr / admin123
Dashboard: http://localhost:10000/admin

## Configuration de l'envoi d'emails (Resend)

La réinitialisation de mot de passe utilise le service **Resend**. Pour que les emails partent vers n'importe quel citoyen (et pas seulement le propriétaire du compte Resend), il faut vérifier le domaine `saintremeze.fr`.

### Prérequis déjà en place
- `RESEND_API_KEY` : déjà définie sur Render (ne pas modifier)

### Étapes pour activer l'envoi depuis @saintremeze.fr

**1. Vérifier le domaine dans Resend**
- Se connecter sur [resend.com](https://resend.com)
- Menu **Domains** → **Add Domain** → saisir `saintremeze.fr`
- Resend affiche 3 enregistrements DNS à créer

**2. Ajouter les enregistrements DNS chez l'hébergeur du domaine**

| Type | Nom | Valeur |
|------|-----|--------|
| `TXT` | `resend._domainkey.saintremeze.fr` | clé DKIM fournie par Resend |
| `MX`  | `send.saintremeze.fr` | `feedback-smtp.us-east-1.amazonses.com` |
| `TXT` | `send.saintremeze.fr` | `v=spf1 include:amazonses.com ~all` |

> Copier les valeurs exactes depuis l'interface Resend — elles peuvent différer légèrement.

**3. Attendre la vérification du domaine**
- Resend vérifie automatiquement (quelques minutes à 48h selon le TTL DNS)
- Le statut passe à **Verified ✅** dans l'interface Resend

**4. Mettre à jour la variable EMAIL_FROM sur Render**
- Sur [render.com](https://render.com) → service backend → **Environment**
- Ajouter ou modifier :

| Variable | Valeur |
|----------|--------|
| `EMAIL_FROM` | `Saint-Remèze <no-reply@saintremeze.fr>` |

Render redémarre automatiquement le service. Aucune modification de code n'est nécessaire.

### Pourquoi ça ne fonctionne pas sans cette configuration
`onboarding@resend.dev` (adresse par défaut) ne peut envoyer qu'à l'adresse du propriétaire du compte Resend. La vérification du domaine lève cette restriction.

### Différence entre les deux clés
- **`resend._domainkey`** : enregistrement DNS public (prouve l'identité du domaine auprès des boîtes mail des destinataires)
- **`RESEND_API_KEY`** : clé secrète privée (authentifie le backend auprès de l'API Resend pour ordonner l'envoi)

---

## Historique des versions

### v7.2.12
- Notification email automatique au citoyen à chaque changement de statut de son signalement
- Email HTML envoyé via Resend (statuts : Vue, En cours, Terminée, Rejetée)
- Nouveau fichier `utils/email.js` — helper réutilisable pour les envois

### v7.2.11
- Export PDF : photo redimensionnée dynamiquement pour tenir sur la même page que le texte du signalement
- Largeur image réduite à 90mm max, hauteur adaptée à l'espace restant sur la page

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
