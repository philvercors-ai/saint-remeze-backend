const { Resend } = require('resend');

const STATUS_LABELS = {
  'Vue':      { label: 'pris en compte',        color: '#7c3aed', emoji: '👁️' },
  'En cours': { label: 'en cours de traitement', color: '#2563eb', emoji: '🔧' },
  'Terminée': { label: 'terminé',                color: '#16a34a', emoji: '✅' },
  'Rejetée':  { label: 'rejeté',                 color: '#dc2626', emoji: '❌' },
};

/**
 * Envoie un email au citoyen lors d'un changement de statut de son signalement.
 * Silencieux en cas d'erreur (ne bloque jamais la réponse HTTP).
 */
async function sendStatusChangeEmail(user, remark, newStatus) {
  if (!process.env.RESEND_API_KEY || !user?.email) return;

  const info = STATUS_LABELS[newStatus];
  if (!info) return; // Pas d'email pour "En attente"

  const frontendUrl = process.env.FRONTEND_URL || 'https://saint-remeze-frontend.vercel.app';
  const remarkUrl   = `${frontendUrl}/remark/${remark._id}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Saint-Remèze <onboarding@resend.dev>',
      to: user.email,
      subject: `${info.emoji} Votre signalement a été ${info.label} — Saint-Remèze`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">

        <!-- En-tête -->
        <tr>
          <td style="background:#1a3a5a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.02em;">
              🏛️ Commune de Saint-Remèze
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#c9a84c;text-transform:uppercase;letter-spacing:.08em;">
              Espace Citoyen — Signalements
            </p>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">
              Bonjour <strong>${user.name || 'Citoyen'}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Le statut de votre signalement a été mis à jour par la mairie.
            </p>

            <!-- Bloc signalement -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">
                    Signalement
                  </p>
                  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1e293b;">
                    ${remark.title}
                  </p>
                  <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">
                    Nouveau statut
                  </p>
                  <span style="display:inline-block;background:${info.color};color:#fff;padding:6px 16px;border-radius:99px;font-size:14px;font-weight:700;">
                    ${info.emoji} ${newStatus}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Bouton -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1a3a5a;border-radius:8px;">
                  <a href="${remarkUrl}"
                    style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                    Voir mon signalement →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              Si vous n'êtes pas l'auteur de ce signalement, ignorez cet email.
            </p>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#f1f5f9;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              © ${new Date().getFullYear()} Commune de Saint-Remèze — Cet email a été envoyé automatiquement.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    console.log(`📧 Email statut "${newStatus}" envoyé à ${user.email}`);
  } catch (err) {
    console.error('❌ Erreur envoi email statut:', err.message);
  }
}

module.exports = { sendStatusChangeEmail };
