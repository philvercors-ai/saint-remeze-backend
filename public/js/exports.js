/**
 * FONCTIONS D'EXPORTATION - SAINT-REMEZE
 * Ce fichier gère l'export CSV et PDF (avec graphiques, photos, tél et GPS)
 */

// --- EXPORT CSV ---
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) {
        alert('Aucune remarque à exporter');
        return;
    }
    
    let csv = "Date,Citoyen,Email,Telephone,Categorie,Titre,Statut,Description,Assigne_a,Notes_admin\n";
    
    data.forEach(r => {
        const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
        const userName = (r.user?.name || r.name || 'Anonyme').replace(/"/g, '""');
        const userEmail = (r.user?.email || r.email || 'N/A').replace(/"/g, '""');
        const userPhone = (r.user?.phone || r.phone || 'N/A').replace(/"/g, '""');
        const category = (r.category || '').replace(/"/g, '""');
        const title = (r.title || '').replace(/"/g, '""');
        const status = (r.status || '').replace(/"/g, '""');
        const desc = (r.description || '').replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
        const assigned = (r.assignedTo || '').replace(/"/g, '""');
        const notes = (r.adminNotes || '').replace(/"/g, '""');
        
        csv += `"${date}","${userName}","${userEmail}","${userPhone}","${category}","${title}","${status}","${desc}","${assigned}","${notes}"\n`;
    });
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export-saint-remeze-${currentTab}.csv`;
    link.click();
}

// --- EXPORT PDF ---
async function exportPDF(data, currentTab) {
    if (!data || data.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    const clean = (str) => {
        if (!str) return "N/A";
        return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\xC0-\xFF]/g, '').trim();
    };

    // --- PAGE 1 : STATISTIQUES ET GRAPHIQUES ---
    doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(37, 99, 235);
    doc.text("Saint-Remèze", margin, 20);
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(100);
    doc.text("ARDECHE", margin, 26);
    doc.setDrawColor(37, 99, 235).setLineWidth(0.5).line(margin, 30, pageWidth - margin, 30);

    const reportTitle = currentTab === 'archived' ? "Rapport des Remarques Archivées" : "Rapport des Remarques Actives";
    doc.setFontSize(18).setTextColor(0).text(reportTitle, pageWidth / 2, 45, { align: 'center' });

    // Calcul des statistiques
    const statsStatus = {};
    const statsCat = {};
    data.forEach(r => {
        statsStatus[r.status] = (statsStatus[r.status] || 0) + 1;
        statsCat[r.category] = (statsCat[r.category] || 0) + 1;
    });

    // Dessin simplifié des graphiques (Légendes colorées)
    let yStats = 65;
    doc.setFontSize(14).setFont('helvetica', 'bold').text("Répartition par Statut", margin, yStats);
    yStats += 10;
    Object.entries(statsStatus).forEach(([label, count]) => {
        doc.setFontSize(11).setFont('helvetica', 'normal').text(`• ${label} : ${count}`, margin + 5, yStats);
        yStats += 7;
    });

    yStats += 10;
    doc.setFontSize(14).setFont('helvetica', 'bold').text("Répartition par Catégories", margin, yStats);
    yStats += 10;
    Object.entries(statsCat).forEach(([label, count]) => {
        doc.setFontSize(11).setFont('helvetica', 'normal').text(`• ${label} : ${count}`, margin + 5, yStats);
        yStats += 7;
    });

    // --- PAGES DE DÉTAILS ---
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        doc.addPage();
        let y = 20;

        // Photo en haut si elle existe
        const photo = r.imageUrl || r.image;
        if (photo) {
            try {
                // On insère la photo (format paysage 80x60)
                doc.addImage(photo, 'JPEG', margin, y, 80, 60);
                y += 70;
            } catch (e) { y += 5; }
        }

        doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(0);
        doc.text(`${i + 1}. ${clean(r.title)}`, margin, y);
        y += 10;

        // Infos principales
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold').text("STATUT : ", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(r.status).toUpperCase(), margin + 25, y);
        
        doc.setFont('helvetica', 'bold').text("CATÉGORIE : ", 110, y);
        doc.setFont('helvetica', 'normal').text(clean(r.category), 140, y);
        y += 10;

        const userName = r.user?.name || r.name || 'Anonyme';
        const userEmail = r.user?.email || r.email || 'N/A';
        const userPhone = r.user?.phone || r.phone || 'N/A';

        doc.setFont('helvetica', 'bold').text("Déclarant :", margin, y);
        doc.setFont('helvetica', 'normal').text(clean(userName), margin + 25, y);
        y += 7;
        doc.text(`Email : ${userEmail} | Tél : ${userPhone}`, margin, y);
        y += 10;

        // Description
        doc.setFont('helvetica', 'bold').text("Description :", margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(clean(r.description), pageWidth - (margin * 2));
        doc.text(splitDesc, margin, y);
        y += (splitDesc.length * 6) + 10;

        // Notes et GPS
        if (r.adminNotes) {
            doc.setFont('helvetica', 'bold').text("Notes Admin :", margin, y);
            doc.setFont('helvetica', 'normal').text(clean(r.adminNotes), margin + 30, y);
            y += 10;
        }

        if (r.location?.coordinates) {
            const [lng, lat] = r.location.coordinates;
            doc.setFontSize(9).setTextColor(37, 99, 235);
            doc.text(`Localisation GPS : Latitude ${lat.toFixed(6)} / Longitude ${lng.toFixed(6)}`, margin, y);
        }
    }

    doc.save(`Rapport-Saint-Remeze-${currentTab}.pdf`);
}

// Rendre les fonctions disponibles pour admin.html
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;