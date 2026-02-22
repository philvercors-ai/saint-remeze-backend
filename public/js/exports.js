// ═════════════════════════════════════════
// FONCTIONS EXPORT PDF ET CSV
// Saint-Remèze - Dashboard Admin
// ═════════════════════════════════════════

/**
 * Export CSV des remarques
 * @param {Array} data - Tableau des remarques
 * @param {string} currentTab - Onglet actif ('active' ou 'archived')
 */
function exportCSV(data, currentTab) {
    if (!data || data.length === 0) {
        alert('Aucune remarque à exporter');
        return;
    }
    
    // En-têtes CSV
    let csv = "Date,Citoyen,Email,Categorie,Titre,Statut,Description,Assigne_a,Notes_admin,Archive";
    
    if (currentTab === 'archived') {
        csv += ",Jours_archives";
    }
    
    csv += "\n";
    
    // Données
    data.forEach(r => {
        const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
        const userName = (r.user?.name || r.name || 'Anonyme').replace(/"/g, '""');
        const userEmail = (r.user?.email || r.email || 'N/A').replace(/"/g, '""');
        const category = (r.category || '').replace(/"/g, '""');
        const title = (r.title || '').replace(/"/g, '""');
        const status = (r.status || '').replace(/"/g, '""');
        const desc = (r.description || '').replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
        const assigned = (r.assignedTo || '').replace(/"/g, '""');
        const notes = (r.adminNotes || '').replace(/"/g, '""');
        const archived = r.archived ? 'Oui' : 'Non';
        
        let row = `"${date}","${userName}","${userEmail}","${category}","${title}","${status}","${desc}","${assigned}","${notes}","${archived}"`;
        
        if (currentTab === 'archived' && r.archivedAt) {
            const daysSince = Math.floor((Date.now() - new Date(r.archivedAt)) / (1000*60*60*24));
            row += `,"${daysSince}"`;
        }
        
        csv += row + "\n";
    });
    
    // Téléchargement
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const filename = currentTab === 'archived' 
        ? `remarques-archives-${new Date().toISOString().split('T')[0]}.csv`
        : `remarques-actives-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ Export CSV réussi: ${data.length} remarque(s)`);
}

/**
 * Export PDF des remarques avec graphiques
 * @param {Array} data - Tableau des remarques
 * @param {string} currentTab - Onglet actif ('active' ou 'archived')
 */
async function exportPDF(data, currentTab) {
    if (!data || data.length === 0) {
        alert('Aucune remarque à exporter');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    
    // Fonction nettoyage texte
    const clean = (str) => {
        if (!str) return "N/A";
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E\xC0-\xFF]/g, '')
            .trim();
    };
    
    // Fonction création graphique camembert
    async function createBeautifulPieChart(labels, chartData, colors, title) {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            canvas.width = 500;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            const chart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: colors,
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: false,
                    animation: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                font: { 
                                    size: 14,
                                    family: 'Arial',
                                    weight: '600'
                                },
                                boxWidth: 22,
                                padding: 15,
                                color: '#1e293b',
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        title: {
                            display: true,
                            text: title,
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#1e293b',
                            padding: {
                                top: 10,
                                bottom: 18
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    }
                },
                plugins: [{
                    id: 'datalabels',
                    afterDatasetsDraw: function(chart) {
                        const ctx = chart.ctx;
                        chart.data.datasets.forEach((dataset, i) => {
                            const meta = chart.getDatasetMeta(i);
                            meta.data.forEach((element, index) => {
                                const data = dataset.data[index];
                                const total = dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((data / total) * 100).toFixed(0);
                                
                                if (percentage > 5) {
                                    ctx.fillStyle = '#ffffff';
                                    ctx.font = 'bold 18px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.shadowColor = 'rgba(0,0,0,0.3)';
                                    ctx.shadowBlur = 2;
                                    
                                    const position = element.tooltipPosition();
                                    ctx.fillText(percentage + '%', position.x, position.y);
                                    
                                    ctx.shadowBlur = 0;
                                }
                            });
                        });
                    }
                }]
            });
            
            setTimeout(() => {
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = 500;
                finalCanvas.height = 500;
                const finalCtx = finalCanvas.getContext('2d');
                
                finalCtx.fillStyle = '#ffffff';
                finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                finalCtx.drawImage(canvas, 0, 0);
                
                const imageData = finalCanvas.toDataURL('image/png', 1.0);
                chart.destroy();
                resolve(imageData);
            }, 800);
        });
    }
    
    // PAGE 1 : STATISTIQUES
    let y = 20;
    
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(37, 99, 235);
    doc.text("Saint-Remeze", margin, y);
    
    y += 6;
    doc.setFontSize(11).setFont('helvetica', 'normal').setTextColor(100);
    doc.text("ARDECHE", margin, y);
    
    y += 5;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    
    y += 15;
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(0);
    const title = currentTab === 'archived' ? "Rapport des Remarques Archivees" : "Rapport des Remarques Actives";
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    
    y += 8;
    doc.setFontSize(13).setTextColor(100);
    doc.text("Commune de Saint-Remeze", pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(10).setTextColor(0);
    const now = new Date();
    doc.text(`Genere le ${now.toLocaleDateString('fr-FR')} a ${now.toLocaleTimeString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });
    
    y += 15;
    doc.setFontSize(14).setFont('helvetica', 'bold');
    doc.text("Statistiques globales", margin, y);
    
    y += 8;
    doc.setFontSize(11).setFont('helvetica', 'normal');
    
    if (currentTab === 'active') {
        doc.text(`Total des signalements actifs : ${data.length}`, margin, y);
        y += 7;
        doc.text(`En attente: ${data.filter(r => r.status === 'En attente').length}   En cours: ${data.filter(r => r.status === 'En cours').length}   Terminees: ${data.filter(r => r.status === 'Terminée').length}   Rejetees: ${data.filter(r => r.status === 'Rejetée').length}`, margin, y);
    } else {
        doc.text(`Total des remarques archivees : ${data.length}`, margin, y);
    }
    
    y += 10;
    
    try {
        // Graphique statuts
        const statusCounts = [
            data.filter(r => r.status === 'En attente').length,
            data.filter(r => r.status === 'En cours').length,
            data.filter(r => r.status === 'Terminée').length,
            data.filter(r => r.status === 'Rejetée').length
        ];
        const statusLabels = ['En attente', 'En cours', 'Terminee', 'Rejetee'];
        const statusColors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];
        
        const imgStatus = await createBeautifulPieChart(statusLabels, statusCounts, statusColors, 'Repartition par statuts');
        
        const chartSize = 85;
        doc.addImage(imgStatus, 'PNG', margin, y, chartSize, chartSize);
        
        // Graphique catégories
        const categories = {};
        data.forEach(r => {
            categories[r.category] = (categories[r.category] || 0) + 1;
        });
        
        const catLabels = Object.keys(categories);
        const catCounts = Object.values(categories);
        const catColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
        
        const imgCat = await createBeautifulPieChart(catLabels, catCounts, catColors, 'Repartition par categories');
        
        doc.addImage(imgCat, 'PNG', pageWidth - margin - chartSize, y, chartSize, chartSize);
        
    } catch (error) {
        console.error('Erreur graphiques:', error);
    }
    
    // PAGES DÉTAILS
    for (let i = 0; i < data.length; i++) {
        const r = data[i];
        
        doc.addPage();
        y = 15;
        
        doc.setFontSize(9).setFont('helvetica', 'italic').setTextColor(100);
        doc.text("Mairie de Saint-Remeze - Rapport de signalement", margin, y);
        
        y += 3;
        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        
        y += 12;
        doc.setFontSize(15).setFont('helvetica', 'bold').setTextColor(0);
        doc.text(`${i + 1}. ${clean(r.title)}`, margin, y);
        
        y += 12;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("STATUT :", margin, y);
        
        const statusColors = {
            'Terminée': [16, 185, 129],
            'Rejetée': [239, 68, 68],
            'En cours': [59, 130, 246],
            'En attente': [245, 158, 11]
        };
        const color = statusColors[r.status] || [100, 100, 100];
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(r.status.toUpperCase(), margin + 25, y);
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text("CATEGORIE :", 110, y);
        doc.setFont('helvetica', 'normal');
        doc.text(clean(r.category), 140, y);
        
        y += 10;
        doc.setTextColor(0).setFontSize(10).setFont('helvetica', 'normal');
        
        const userName = r.user?.name || r.name || 'Anonyme';
        const userEmail = r.user?.email || r.email || 'N/A';
        const userPhone = r.user?.phone || r.phone || 'N/A';
        
        doc.text(`Declarant : ${clean(userName)}`, margin, y);
        
        y += 6;
        doc.text(`Email : ${userEmail}`, margin, y);
        doc.text(`Tel : ${userPhone}`, 110, y);
        
        y += 6;
        doc.text(`Date : ${new Date(r.createdAt).toLocaleDateString('fr-FR')}`, margin, y);
        
        if (r.archived && r.archivedAt) {
            const daysSince = Math.floor((Date.now() - new Date(r.archivedAt)) / (1000*60*60*24));
            doc.text(`Archivee depuis : ${daysSince} jours`, 110, y);
        }
        
        y += 6;
        doc.setDrawColor(230);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.text("Description :", margin, y);
        
        y += 7;
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(clean(r.description || 'Aucune description'), pageWidth - 2*margin);
        doc.text(splitDesc, margin, y);
        
        y += (splitDesc.length * 5) + 10;
        
        if (r.assignedTo) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Assigne a :`, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(clean(r.assignedTo), margin + 30, y);
            y += 7;
        }
        
        if (r.adminNotes) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Notes admin :`, margin, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(clean(r.adminNotes), pageWidth - 2*margin);
            doc.text(splitNotes, margin, y);
            y += (splitNotes.length * 5) + 7;
        }
        
        if (r.location && r.location.coordinates) {
            const [lng, lat] = r.location.coordinates;
            doc.setFont('helvetica', 'bold');
            doc.text(`Localisation :`, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`, margin + 35, y);
        }
    }
    
    const filename = currentTab === 'archived'
        ? `rapport-archives-${now.toISOString().split('T')[0]}.pdf`
        : `rapport-actives-${now.toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);
    
    alert(`✅ Export PDF réussi: ${data.length} remarque(s)`);
}

// Export pour utilisation dans admin.html
if (typeof window !== 'undefined') {
    window.exportCSV = exportCSV;
    window.exportPDF = exportPDF;
}
