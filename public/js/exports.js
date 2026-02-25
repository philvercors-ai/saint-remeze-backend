/**
 * exports.js - Version avec Bargraph pour les catégories
 * Saint-Remèze - Dashboard Admin
 */

// --- UTILITAIRE : Chargement sécurisé des images ---
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("Erreur de chargement de l'image"));
        img.src = url;
    });
};

// --- UTILITAIRE : Dessin de graphique camembert (pour les Statuts) ---
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
        const color = colors[i % colors.length];
        doc.setFillColor(color[0], color[1], color[2]);
        
        const segments = 30;
        for (let s = 0; s < segments; s++) {
            const step = sliceAngle / segments;
            const a1 = startAngle + s * step;
            const a2 = startAngle + (s + 1) * step;
            doc.triangle(x, y, x + Math.cos(a1) * radius, y + Math.sin(a1) * radius, x + Math.cos(a2) * radius, y + Math.sin(a2) * radius, 'F');
        }

        const ly = y - radius + (i * 7);
        doc.rect(x + radius + 10, ly, 4, 4, 'F');
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60);
        doc.text(`${label}: ${value}`, x + radius + 17, ly + 3.5);
        startAngle += sliceAngle;
    });
}

// --- UTILITAIRE : Dessin de Bargraph (pour les Catégories) ---
function drawBarChart(doc, x, y, width, dataObj, title) {
    const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]); // Trier par valeur décroissante
    const maxVal = Math.max(...Object.values(dataObj));
    const barHeight = 6;
    const gap = 4;

    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(40);
    doc.text(title, x, y - 5);

    entries.forEach(([label, value], i) => {
        const currentY = y + (i * (barHeight + gap));
        const barWidth = (value / maxVal) * (width - 40); // 40px réservés pour le texte du chiffre

        // Couleur de la barre (Bleu Saint-Remèze)
        doc.setFillColor(37, 99, 235);
        doc.rect(x, currentY, barWidth, barHeight, 'F');

        // Texte de la catégorie
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60);
        doc.text(`${label}`, x, currentY - 1);
        
        // Valeur au bout de la barre
        doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(40);
        doc.text(value.toString(), x + barWidth + 2, currentY + 4.5);
    });
    
    return entries.length * (barHeight + gap) + 10; // Retourne la hauteur totale utilisée
}

// --- EXPORT CSV ---
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) return alert('Aucune donnée');
    let csv = "\ufeffDate,Citoyen,Email,Telephone,Categorie,Titre,Statut,Description,Notes_admin\n";
    data.forEach(r => {
        const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
        const desc = (r.description || '').replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
        csv += `"${date}","${r.user?.name || r.name || 'Anonyme'}","${r.user?.email || 'N/A'}","${r.user?.phone || 'N/A'}","${r.category}","${r.title}","${r.status}","${desc}","${r.adminNotes || ''}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `export-saint-remeze-${currentTab}.csv`;
    link.click();
}

// --- EXPORT PDF ---
async function exportPDF(data, currentTab) {
    if (!data || data.length === 0) return alert('Aucune donnée à exporter');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    const clean = (str) => String(str || 'N/A').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

    // --- PAGE 1 : STATISTIQUES ---
    doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(37, 99, 235);
    doc.text("Saint-Remèze", margin, 20);
    doc.setDrawColor(37, 99, 235).setLineWidth(0.5).line(margin, 25, pageWidth - margin, 25);

    const reportTitle = currentTab === 'archived' ? "Rapport des Remarques Archivées" : "Rapport des Remarques Actives";
    doc.setFontSize(18).setTextColor(0).text(reportTitle, pageWidth / 2, 45, { align: 'center' });

    const statsStatus = {};
    const statsCat = {};
    data.forEach(r => {
        statsStatus[r.status] = (statsStatus[r.status] || 0) + 1;
        statsCat[r.category] = (statsCat[r.category] || 0) + 1;
    });

    // 1. Camembert pour les statuts (peu d'options)
    drawPieChart(doc, 60, 100, 25, statsStatus, "Répartition par Statut");

    // 2. Bargraph pour les catégories (beaucoup d'options)
    drawBarChart(doc, margin, 150, pageWidth - (margin * 2), statsCat, "Répartition par Catégories");

    // --- PAGES DE DÉTAILS ---
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        doc.addPage();
        let y = 20;

        // Photo centrée horizontalement
        const photoUrl = r.imageUrl || r.image;
        if (photoUrl) {
            try {
                const img = await loadImage(photoUrl);
                const imgWidth = 100; // Taille un peu plus grande pour le détail
                const ratio = img.width / img.height;
                const imgHeight = imgWidth / ratio;
                const xCentered = (pageWidth - imgWidth) / 2;
                doc.addImage(img, 'JPEG', xCentered, y, imgWidth, imgHeight);
                y += imgHeight + 15;
            } catch (e) {
                y += 10;
            }
        }

        doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(0);
        doc.text(`${i + 1}. ${clean(r.title)}`, margin, y);
        y += 10;

        // Infos principales
        doc.setFontSize(10).setFont('helvetica', 'bold').text("STATUT :", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(r.status).toUpperCase(), margin + 25, y);
        doc.setFont('helvetica', 'bold').text("CATÉGORIE :", 110, y);
        doc.setFont('helvetica', 'normal').text(clean(r.category), 140, y);
        y += 10;

        const userName = r.user?.name || r.name || 'Anonyme';
        doc.setFont('helvetica', 'bold').text("Déclarant :", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(userName), margin + 25, y);
        y += 7;
        doc.text(`Email : ${r.user?.email || 'N/A'} | Tél : ${r.user?.phone || 'N/A'}`, margin, y);
        y += 10;

        doc.setFont('helvetica', 'bold').text("Description :", margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(clean(r.description), pageWidth - (margin * 2));
        doc.text(splitDesc, margin, y);
        y += (splitDesc.length * 5) + 12;

        if (r.adminNotes) {
            doc.setDrawColor(200).line(margin, y, margin + 40, y); y += 7;
            doc.setFont('helvetica', 'bold').text("Notes Admin :", margin, y);
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(clean(r.adminNotes), pageWidth - (margin * 2));
            doc.text(splitNotes, margin, y + 6);
            y += (splitNotes.length * 5) + 15;
        }

        if (r.location?.coordinates) {
            const [lng, lat] = r.location.coordinates;
            doc.setFontSize(9).setTextColor(37, 99, 235);
            doc.text(`Localisation GPS : Latitude ${lat.toFixed(6)} / Longitude ${lng.toFixed(6)}`, margin, y);
        }
    }

    doc.save(`Rapport-Saint-Remeze-${currentTab}.pdf`);
}

window.exportCSV = exportCSV;
window.exportPDF = exportPDF;