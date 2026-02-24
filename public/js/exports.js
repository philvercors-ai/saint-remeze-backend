/**
 * exports.js - Version Enrichie avec Graphiques et Photos
 * Saint-Remèze - Dashboard Admin
 */

// --- FONCTION UTILITAIRE : Chargement des images ---
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
};

// --- FONCTION UTILITAIRE : Dessin d'un camembert ---
function drawPieChart(doc, x, y, radius, dataObj, title) {
    const entries = Object.entries(dataObj);
    const total = entries.reduce((sum, [_, val]) => sum + val, 0);
    let startAngle = 0;
    
    // Palette de couleurs élégante
    const colors = [
        [37, 99, 235], [16, 185, 129], [245, 158, 11], 
        [239, 68, 68], [139, 92, 246], [71, 85, 105]
    ];

    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(40);
    doc.text(title, x, y - radius - 10, { align: 'center' });

    entries.forEach(([label, value], i) => {
        const sliceAngle = (value / total) * (Math.PI * 2);
        const color = colors[i % colors.length];
        
        doc.setFillColor(color[0], color[1], color[2]);
        
        // Dessin du segment (Approximation par triangles pour compatibilité maximale)
        const segments = 30;
        for (let s = 0; s < segments; s++) {
            const step = sliceAngle / segments;
            const a1 = startAngle + s * step;
            const a2 = startAngle + (s + 1) * step;
            
            doc.triangle(
                x, y,
                x + Math.cos(a1) * radius, y + Math.sin(a1) * radius,
                x + Math.cos(a2) * radius, y + Math.sin(a2) * radius,
                'F'
            );
        }

        // Légende à côté
        const ly = y - radius + (i * 7);
        doc.rect(x + radius + 10, ly, 4, 4, 'F');
        doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(60);
        doc.text(`${label}: ${value}`, x + radius + 17, ly + 3.5);

        startAngle += sliceAngle;
    });
}

// --- EXPORT CSV (Conservé) ---
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) return alert('Aucune donnée');
    let csv = "\ufeffDate,Citoyen,Email,Telephone,Categorie,Titre,Statut,Description\n";
    data.forEach(r => {
        csv += `"${new Date(r.createdAt).toLocaleDateString()}","${r.user?.name || 'Anonyme'}","${r.user?.email || 'N/A'}","${r.user?.phone || 'N/A'}","${r.category}","${r.title}","${r.status}","${(r.description || '').replace(/\n/g, ' ')}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `export-${currentTab}.csv`;
    link.click();
}

// --- EXPORT PDF ENRICHI ---
async function exportPDF(data, currentTab) {
    if (!data || data.length === 0) return alert('Aucune donnée');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    const clean = (s) => String(s || 'N/A').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

    // --- PAGE 1 : COUVERTURE ET GRAPHES ---
    // Bandeau bleu
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFontSize(24).setFont('helvetica', 'bold').setTextColor(255);
    doc.text("SAINT-REMÈZE", margin, 25);
    doc.setFontSize(10).setFont('helvetica', 'normal').text("RAPPORT OFFICIEL DES SIGNALEMENTS", margin, 32);

    const reportTitle = currentTab === 'archived' ? "ARCHIVES COMMUNALES" : "SIGNALEMENTS ACTIFS";
    doc.setFontSize(18).setTextColor(40).setFont('helvetica', 'bold');
    doc.text(reportTitle, pageWidth / 2, 60, { align: 'center' });
    
    doc.setFontSize(10).setFont('helvetica', 'italic').setTextColor(100);
    doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, 67, { align: 'center' });

    // Statistiques
    const statsStatus = {};
    const statsCat = {};
    data.forEach(r => {
        statsStatus[r.status] = (statsStatus[r.status] || 0) + 1;
        statsCat[r.category] = (statsCat[r.category] || 0) + 1;
    });

    // Dessin des camemberts
    drawPieChart(doc, 60, 120, 30, statsStatus, "Répartition par Statut");
    drawPieChart(doc, 60, 200, 30, statsCat, "Répartition par Catégorie");

    // --- PAGES DÉTAILS ---
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        doc.addPage();
        let y = 20;

        // Header de page
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100);
        doc.text(`Fiche de signalement n°${i+1} - Mairie de Saint-Remèze`, margin, 10);

        // Photo (Gestion améliorée)
        const photoUrl = r.imageUrl || r.image;
        if (photoUrl) {
            try {
                const img = await loadImage(photoUrl);
                // Calcul du ratio pour ne pas déformer
                const ratio = img.width / img.height;
                const imgW = 100;
                const imgH = imgW / ratio;
                doc.addImage(img, 'JPEG', (pageWidth - imgW) / 2, y, imgW, imgH);
                y += imgH + 10;
            } catch (e) {
                doc.setFontSize(9).setTextColor(200).text("[Image non disponible]", margin, y + 10);
                y += 20;
            }
        }

        // Titre
        doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(37, 99, 235);
        doc.text(`${i + 1}. ${clean(r.title)}`, margin, y);
        y += 10;

        // Bloc Infos Gris
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - (margin * 2), 35, 'F');
        
        doc.setFontSize(10).setTextColor(0);
        let infoY = y + 8;
        doc.setFont('helvetica', 'bold').text("Statut :", margin + 5, infoY);
        doc.setFont('helvetica', 'normal').text(clean(r.status), margin + 30, infoY);
        
        doc.setFont('helvetica', 'bold').text("Catégorie :", 110, infoY);
        doc.setFont('helvetica', 'normal').text(clean(r.category), 135, infoY);
        
        infoY += 8;
        doc.setFont('helvetica', 'bold').text("Déclarant :", margin + 5, infoY);
        doc.setFont('helvetica', 'normal').text(clean(r.user?.name || r.name || 'Anonyme'), margin + 30, infoY);
        
        infoY += 8;
        doc.setFont('helvetica', 'bold').text("Contact :", margin + 5, infoY);
        doc.setFont('helvetica', 'normal').text(`${r.user?.email || 'N/A'} | Tél: ${r.user?.phone || 'N/A'}`, margin + 30, infoY);

        infoY += 8;
        if (r.location?.coordinates) {
            const [lng, lat] = r.location.coordinates;
            doc.setFont('helvetica', 'bold').text("GPS :", margin + 5, infoY);
            doc.setFont('helvetica', 'normal').setTextColor(37, 99, 235).text(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, margin + 30, infoY);
        }
        
        y += 45;

        // Description
        doc.setTextColor(0).setFontSize(11).setFont('helvetica', 'bold').text("Description du problème :", margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal').setFontSize(10);
        const lines = doc.splitTextToSize(clean(r.description), pageWidth - (margin * 2));
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 12;

        // Notes Admin (si présentes)
        if (r.adminNotes) {
            doc.setDrawColor(37, 99, 235).setLineWidth(0.5).line(margin, y, margin + 20, y);
            y += 7;
            doc.setFont('helvetica', 'bold').text("Commentaires de la mairie :", margin, y);
            y += 6;
            doc.setFont('helvetica', 'normal').setTextColor(60);
            const noteLines = doc.splitTextToSize(clean(r.adminNotes), pageWidth - (margin * 2));
            doc.text(noteLines, margin, y);
        }

        // Pied de page
        doc.setFontSize(8).setTextColor(150).text(`Page ${i + 2} / ${data.length + 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`Rapport_Saint_Remeze_${currentTab}.pdf`);
}

window.exportCSV = exportCSV;
window.exportPDF = exportPDF;