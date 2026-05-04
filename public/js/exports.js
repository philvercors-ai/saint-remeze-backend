/**
 * exports.js - Version Finale Corrigée
 * Saint-Remèze - Dashboard Admin
 */


// --- UTILITAIRE : Chargement des images (Gestion CORS et Cloudinary) ---
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image introuvable"));
        // Ajout d'un cache-buster pour forcer le rafraîchissement CORS
        img.src = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    });
};

// --- GRAPHIQUE : Camembert (Statuts) ---
function drawPieChart(doc, x, y, radius, dataObj, title) {
    const entries = Object.entries(dataObj);
    const total = entries.reduce((sum, [_, val]) => sum + val, 0);
    if (total === 0) return;
    let startAngle = 0;
    const colors = [[37, 99, 235], [16, 185, 129], [245, 158, 11], [239, 68, 68], [139, 92, 246]];
    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(40);
    doc.text(title, x, y - radius - 10, { align: 'center' });
    entries.forEach(([label, value], i) => {
        const sliceAngle = (value / total) * (Math.PI * 2);
        doc.setFillColor(...colors[i % colors.length]);
        for (let s = 0; s < 30; s++) {
            const a1 = startAngle + s * (sliceAngle / 30);
            const a2 = startAngle + (s + 1) * (sliceAngle / 30);
            doc.triangle(x, y, x + Math.cos(a1) * radius, y + Math.sin(a1) * radius, x + Math.cos(a2) * radius, y + Math.sin(a2) * radius, 'F');
        }
        const ly = y - radius + (i * 7);
        doc.rect(x + radius + 10, ly, 4, 4, 'F');
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60);
        doc.text(`${label}: ${value}`, x + radius + 17, ly + 3.5);
        startAngle += sliceAngle;
    });
}

// --- GRAPHIQUE : Bargraph (Catégories) ---
function drawBarChart(doc, x, y, width, dataObj, title) {
    const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...Object.values(dataObj));
    const barH = 6; const gap = 4;
    const catColors = [
        [37,  99,  235], // bleu
        [16,  185, 129], // vert
        [245, 158, 11],  // orange
        [239, 68,  68],  // rouge
        [139, 92,  246], // violet
        [20,  184, 166], // teal
        [249, 115, 22],  // orange foncé
        [236, 72,  153], // rose
        [132, 204, 22],  // vert lime
        [59,  130, 246], // bleu clair
        [168, 85,  247], // mauve
    ];
    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(40);
    doc.text(title, x, y - 5);
    entries.forEach(([label, value], i) => {
        const curY = y + (i * (barH + gap));
        const barW = (value / maxVal) * (width - 50);
        const color = catColors[i % catColors.length];
        doc.setFillColor(...color);
        doc.rect(x, curY, barW, barH, 'F');
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60).text(label, x, curY - 1);
        doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(40).text(value.toString(), x + barW + 2, curY + 4.5);
    });
}

// --- EXPORT PDF ---
async function exportPDF(data, currentTab, dateFrom, dateTo) {
    if (!data || data.length === 0) return alert('Aucune donnée');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const clean = (s) => String(s || 'N/A')
        .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'OE')   // œ/Œ → oe/OE (non supporté par Helvetica)
        .replace(/[\u2018\u2019\u201A\u201B\u02BC]/g, "'")    // apostrophes courbes → '
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')           // guillemets courbes → "
        .replace(/[\u2013\u2014]/g, '-')                       // tirets longs → -
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');           // garde ASCII + Latin-1 (é,è,ê,à,ç,î,ô,ù…)

    const fmtDate = (iso) => {
        if (!iso) return null;
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    // --- PAGE 1 : GRAPHIQUES ---
    doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(37, 99, 235).text("Saint-Remeze", margin, 20);
    doc.setDrawColor(37, 99, 235).setLineWidth(0.5).line(margin, 25, pageWidth - margin, 25);
    const reportTitle = currentTab === 'archived' ? "Rapport des Signalements Archives" : "Rapport des Signalements Actifs";
    doc.setFontSize(18).setTextColor(0).text(reportTitle, pageWidth / 2, 40, { align: 'center' });

    // Période et nombre de signalements
    let periodText = '';
    if (dateFrom && dateTo)       periodText = `Periode : du ${fmtDate(dateFrom)} au ${fmtDate(dateTo)}`;
    else if (dateFrom)            periodText = `Periode : a partir du ${fmtDate(dateFrom)}`;
    else if (dateTo)              periodText = `Periode : jusqu'au ${fmtDate(dateTo)}`;
    else                          periodText = `Tous les signalements`;
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(80)
       .text(periodText, pageWidth / 2, 50, { align: 'center' });
    doc.setFontSize(10).setTextColor(120)
       .text(`${data.length} signalement(s)  |  Genere le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 57, { align: 'center' });

    const statsStatus = {}; const statsCat = {};
    data.forEach(r => {
        statsStatus[r.status] = (statsStatus[r.status] || 0) + 1;
        statsCat[r.category] = (statsCat[r.category] || 0) + 1;
    });

    drawPieChart(doc, 60, 115, 25, statsStatus, "Repartition par Statut");
    drawBarChart(doc, margin, 165, pageWidth - (margin * 2), statsCat, "Repartition par Categories");

    // --- PAGES DÉTAILS ---
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        doc.addPage();
        let y = 20;

        // Couleurs statut
        const statusColors = {
            'En attente': [245, 158, 11],
            'En cours':   [37, 99, 235],
            'Terminee':   [16, 185, 129],
            'Rejetee':    [239, 68, 68]
        };
        const statusKey = (r.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const statusRGB = statusColors[statusKey] || [100, 100, 100];

        // Titre
        doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(37, 99, 235);
        doc.text(`${i + 1}. ${clean(r.title)}`, margin, y);
        y += 10;

        // Statut en couleur + Catégorie
        doc.setFontSize(10).setTextColor(0);
        doc.setFont('helvetica', 'bold').text("Statut :", margin, y);
        doc.setFont('helvetica', 'bold').setTextColor(...statusRGB).text(clean(r.status).toUpperCase(), margin + 22, y);
        doc.setFont('helvetica', 'bold').setTextColor(0).text("Categorie :", 110, y);
        doc.setFont('helvetica', 'normal').text(clean(r.category), 135, y);
        y += 8;

        // Déclarant
        doc.setFont('helvetica', 'bold').setTextColor(0).text("Declarant :", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(r.user?.name || r.name || 'Anonyme'), margin + 25, y);
        y += 7;

        // Contact
        doc.setFont('helvetica', 'bold').text("Contact :", margin, y);
        doc.setFont('helvetica', 'normal').text(`${r.user?.email || 'N/A'} | Tel : ${r.user?.phone || 'N/A'}`, margin + 25, y);
        y += 7;

        // Description (sous Contact)
        doc.setFont('helvetica', 'bold').text("Description :", margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal').setTextColor(60);
        const lines = doc.splitTextToSize(clean(r.description), pageWidth - (margin * 2));
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 7;

        // Assigné à
        doc.setTextColor(0).setFont('helvetica', 'bold').text("Assigne a :", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(r.assignedTo || 'Non assigne'), margin + 25, y);
        y += 7;

        // Notes admin
        if (r.adminNotes) {
            doc.setFont('helvetica', 'bold').text("Notes de la mairie :", margin, y);
            y += 6;
            doc.setFont('helvetica', 'normal').setTextColor(60);
            doc.text(doc.splitTextToSize(clean(r.adminNotes), pageWidth - (margin * 2)), margin, y);
            y += 10;
        }

        // GPS - cliquable et en bleu
        if (r.location?.coordinates) {
            const [lng, lat] = r.location.coordinates;
            const coordText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
            doc.setFontSize(10).setTextColor(0).setFont('helvetica', 'bold');
            doc.text("Localisation :", margin, y);
            const labelWidth = doc.getTextWidth("Localisation : ");
            doc.setFont('helvetica', 'normal').setTextColor(37, 99, 235);
            doc.textWithLink(coordText, margin + labelWidth, y, { url: mapsUrl });
            y += 10;
        }

        // Photos (jusqu'à 3)
        const photoUrls = r.photos?.length > 0
          ? r.photos.map(p => p.url)
          : (r.photoUrl ? [r.photoUrl] : []);

        for (const photoUrl of photoUrls) {
          if (!photoUrl || !photoUrl.startsWith('http')) continue;
          try {
            const img = await loadImage(photoUrl);
            const ratio = img.width / img.height;
            const pageH = doc.internal.pageSize.getHeight();
            // Available height on current page (with bottom margin + 5mm padding)
            let availH = pageH - margin - y - 5;
            // If remaining space is too small, start a new page
            if (availH < 30) {
              doc.addPage();
              y = margin;
              availH = pageH - margin * 2;
            }
            // Image max width: 90mm (reduced from 120) to leave room for text
            let imgW = Math.min(90, pageWidth - margin * 2);
            let imgH = imgW / ratio;
            // Scale down to fit remaining page height if needed
            if (imgH > availH) {
              imgH = availH;
              imgW = imgH * ratio;
              if (imgW > 90) { imgW = 90; imgH = imgW / ratio; }
            }
            const imgX = (pageWidth - imgW) / 2;
            doc.addImage(img, 'JPEG', imgX, y, imgW, imgH);
            y += imgH + 10;
          } catch (e) {
            // Photo inaccessible
          }
        }
    }
    doc.save(`Rapport-Saint-Remeze-${currentTab}.pdf`);
}

// --- EXPORT CSV ---
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) return alert('Aucune donnée');
    let csv = "\ufeffDate,Citoyen,Email,Telephone,Categorie,Titre,Statut,Assigné à,Description,Notes_admin\n";
    data.forEach(r => {
        const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
        const desc = (r.description || '').replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
        csv += `"${date}","${r.user?.name || r.name || 'Anonyme'}","${r.user?.email || 'N/A'}","${r.user?.phone || 'N/A'}","${r.category}","${r.title}","${r.status}","${r.assignedTo || 'N/A'}","${desc}","${r.adminNotes || ''}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `export-saint-remeze-${currentTab}.csv`;
    link.click();
}

window.exportCSV = exportCSV;
window.exportPDF = exportPDF;