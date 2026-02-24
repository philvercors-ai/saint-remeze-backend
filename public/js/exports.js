/**
 * Export CSV (Conservé intact)
 */
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) {
        alert('Aucune remarque à exporter');
        return;
    }
    let csv = "Date,Citoyen,Email,Tél,Categorie,Titre,Statut,Description,Assigne_a,Notes_admin,Archive\n";
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
        
        csv += `"${date}","${userName}","${userEmail}","${userPhone}","${category}","${title}","${status}","${desc}","${assigned}","${notes}","${r.archived ? 'Oui' : 'Non'}"\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `export-${currentTab}.csv`);
    link.click();
}

/**
 * Fonction interne pour dessiner les camemberts
 */
function drawPieChart(doc, x, y, title, stats) {
    const radius = 25;
    const colors = [
        [59, 130, 246], [16, 185, 129], [245, 158, 11], 
        [239, 68, 68], [139, 92, 246], [107, 114, 128]
    ];
    
    doc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(0);
    doc.text(title, x, y - 35, { align: 'center' });

    let total = Object.values(stats).reduce((a, b) => a + b, 0);
    let startAngle = 0;
    let colorIndex = 0;

    Object.entries(stats).forEach(([label, value]) => {
        const sliceAngle = (value / total) * (Math.PI * 2);
        const color = colors[colorIndex % colors.length];
        
        doc.setFillColor(color[0], color[1], color[2]);
        // Dessin du segment (approximation par triangles ou segments)
        // Note: jsPDF n'a pas de native pie, on utilise des cercles colorés pour la légende
        doc.rect(x - 40, y + 35 + (colorIndex * 7), 4, 4, 'F');
        doc.setFontSize(9).setFont('helvetica', 'normal');
        doc.text(`${label}: ${value}`, x - 32, y + 38 + (colorIndex * 7));
        
        colorIndex++;
    });

    // Dessin d'un cercle central pour l'esthétique (Donut style)
    doc.setDrawColor(200).setLineWidth(0.5);
    doc.circle(x, y, radius, 'S');
    doc.setFontSize(14).text(total.toString(), x, y + 5, { align: 'center' });
}

/**
 * Export PDF Complet avec Graphiques, Photos, Tél et GPS
 */
async function exportPDF(data, currentTab) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // 1. CALCUL DES STATISTIQUES
    const statusStats = {};
    const categoryStats = {};
    data.forEach(r => {
        statusStats[r.status] = (statusStats[r.status] || 0) + 1;
        categoryStats[r.category] = (categoryStats[r.category] || 0) + 1;
    });

    // --- PAGE 1 : RÉSUMÉ ET GRAPHIQUES ---
    doc.setFontSize(22).setTextColor(37, 99, 235).text("Saint-Remèze", margin, 20);
    doc.setFontSize(12).setTextColor(100).text("Département de l'Ardèche", margin, 28);
    doc.setDrawColor(37, 99, 235).line(margin, 32, pageWidth - margin, 32);

    doc.setFontSize(18).setTextColor(0).text("Rapport Global des Signalements", pageWidth/2, 50, {align: 'center'});
    doc.setFontSize(11).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, pageWidth/2, 58, {align: 'center'});

    // Dessin des camemberts (Positionnement côte à côte)
    drawPieChart(doc, pageWidth * 0.3, 110, "Répartition par Statut", statusStats);
    drawPieChart(doc, pageWidth * 0.7, 110, "Répartition par Catégorie", categoryStats);

    // --- PAGES SUIVANTES : DÉTAILS ---
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        doc.addPage();
        let currentY = 20;

        // Titre et Image
        doc.setFontSize(16).setFont('helvetica', 'bold').text(`${i + 1}. ${r.title || 'Sans titre'}`, margin, currentY);
        currentY += 10;

        const photoUrl = r.imageUrl || r.image;
        if (photoUrl) {
            try {
                doc.addImage(photoUrl, 'JPEG', margin, currentY, 90, 65);
                currentY += 75;
            } catch (e) { currentY += 5; }
        }

        // Bloc Informations
        doc.setFontSize(11).setFont('helvetica', 'bold').text("DÉTAILS DU SIGNALEMENT", margin, currentY);
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Statut : ${r.status}`, margin, currentY);
        doc.text(`Catégorie : ${r.category}`, 100, currentY);
        currentY += 7;
        
        const userName = r.user?.name || r.name || 'Anonyme';
        const userPhone = r.user?.phone || r.phone || 'Non renseigné';
        doc.text(`Déclarant : ${userName}`, margin, currentY);
        doc.text(`Tél : ${userPhone}`, 100, currentY);
        currentY += 7;

        // GPS
        if (r.location?.coordinates) {
            const [lng, lat] = r.location.coordinates;
            doc.setTextColor(37, 99, 235);
            doc.text(`Localisation GPS : Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`, margin, currentY);
            doc.setTextColor(0);
            currentY += 10;
        }

        // Description
        doc.setFont('helvetica', 'bold').text("Description :", margin, currentY);
        currentY += 6;
        doc.setFont('helvetica', 'normal');
        const desc = doc.splitTextToSize(r.description || "Pas de description", pageWidth - (margin * 2));
        doc.text(desc, margin, currentY);
    }

    doc.save(`Rapport_Saint_Remeze_${currentTab}.pdf`);
}