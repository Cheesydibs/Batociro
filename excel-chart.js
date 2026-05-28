document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('excelFile');
    const ctx = document.getElementById('excelChart').getContext('2d');
    let chart = null;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!rows || rows.length === 0) {
            alert('Geen gegevens gevonden in het Excel-blad.');
            return;
        }

        // Expect first row to be headers like ['Label','Value'] or just data in first two columns
        const headers = rows[0].map(h => (h || '').toString().toLowerCase());
        let labelIdx = 0, valueIdx = 1;
        const labelNames = ['label', 'name', 'categorie', 'cat'];
        const valueNames = ['value', 'waarde', 'count', 'aantal', 'number'];

        for (let i = 0; i < headers.length; i++) {
            if (labelNames.includes(headers[i])) labelIdx = i;
            if (valueNames.includes(headers[i])) valueIdx = i;
        }

        // If headers row doesn't look like headers (contains numbers), treat the first row as data
        let dataRows = rows.slice(1);
        const firstRowIsData = rows[0].some(cell => typeof cell === 'number');
        if (firstRowIsData) {
            dataRows = rows.slice(0);
        }

        const labels = dataRows.map(r => r[labelIdx] != null ? String(r[labelIdx]) : '');
        const values = dataRows.map(r => {
            const v = r[valueIdx];
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        });

        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: headers[valueIdx] || 'Value',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    });
});
