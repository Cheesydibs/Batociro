document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('excelFile');
    const rangeSelect = document.getElementById('rangeSelect');
    const chartTypeSelectors = Array.from(document.querySelectorAll('.chartType'));
    const fullscreenButtons = Array.from(document.querySelectorAll('.fullscreen-btn'));
    const canvasIds = ['excelChart0', 'excelChart1', 'excelChart2', 'excelChart3'];
    const charts = [null, null, null, null];

    let allPoints = []; // {date: Date|null, label: string, values: {name: value}}
    let datasetNames = []; // track all dataset names found
    const chartDatasets = {
        0: ['temperature', 'temp', 'humidity', 'hum', 'rh'],
        1: ['stem thickness', 'stem_thickness', 'stem', 'dikte'],
        2: ['sap', 'sap flow', 'sapflow'],
        3: ['light', 'light level', 'light levels', 'ppfd']
    };
    const chartUnits = {
        0: { yAxis: 'Temperature / Humidity', defaultUnit: '' },
        1: { yAxis: 'Current (mA)', defaultUnit: 'mA' },
        2: { yAxis: 'Current (mA)', defaultUnit: 'mA' },
        3: { yAxis: 'PPFD (μmol/m²s)', defaultUnit: 'μmol/m²s' }
    };

    function getUnitForDataset(chartIdx, columnName) {
        if (chartIdx === 0) {
            const key = columnName.toLowerCase();
            if (key.includes('temp')) return '°C';
            if (key.includes('humid') || key.includes('rh')) return '%';
            return '';
        }
        return chartUnits[chartIdx]?.defaultUnit || '';
    }

    function parseDate(val) {
        if (!val && val !== 0) return null;
        // If it's already a Date
        if (val instanceof Date) return val;
        // Excel can give numbers (dates as serials) — XLSX converts them to JS dates sometimes
        if (typeof val === 'number') {
            // try treating as Excel epoch serial (days since 1899-12-31)
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
            if (!isNaN(date.getTime())) return date;
        }
        // Try Date.parse
        const s = String(val);
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;
        // Try common European format dd-mm-yyyy or dd/mm/yyyy
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const month = parseInt(m[2], 10) - 1;
            const year = parseInt(m[3], 10);
            const dd = new Date(year < 100 ? 2000 + year : year, month, day);
            if (!isNaN(dd.getTime())) return dd;
        }
        return null;
    }

    function formatDate(d) {
        if (!d) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function readWorkbookRows(workbook) {
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return rows;
    }

    function rowsToPoints(rows) {
        if (!rows || rows.length === 0) return [];
        const headers = rows[0].map(h => (h || '').toString().toLowerCase());
        const dateNames = ['date', 'datum', 'time', 'tijd'];
        const labelNames = ['label', 'name', 'categorie', 'cat', 'category'];

        let dateIdx = -1, labelIdx = -1;
        for (let i = 0; i < headers.length; i++) {
            if (dateNames.includes(headers[i])) dateIdx = i;
            if (labelNames.includes(headers[i])) labelIdx = i;
        }

        const firstRowIsData = rows[0].some(c => typeof c === 'number' || parseDate(c) !== null);
        const dataRows = firstRowIsData ? rows.slice(0) : rows.slice(1);

        if (dateIdx === -1) dateIdx = 0;
        if (labelIdx === -1) labelIdx = dateIdx;

        const valueIndices = [];
        for (let i = 0; i < headers.length; i++) {
            if (i !== dateIdx && i !== labelIdx) {
                valueIndices.push(i);
            }
        }
        if (valueIndices.length === 0) {
            valueIndices.push(1);
        }

        const points = dataRows.map(row => {
            const rawDate = row[dateIdx];
            const d = parseDate(rawDate);
            const label = (row[labelIdx] != null) ? String(row[labelIdx]) : (d ? formatDate(d) : '');
            const values = {};
            valueIndices.forEach((idx, i) => {
                const colName = headers[idx] || `Value ${i + 1}`;
                const v = Number(row[idx]);
                values[colName] = Number.isFinite(v) ? v : null;
            });
            return { date: d, label, values };
        }).filter(p => p.label !== '' || p.date !== null);

        const withDates = points.filter(p => p.date !== null);
        const withoutDates = points.filter(p => p.date === null);
        withDates.sort((a,b) => a.date - b.date);
        return withDates.concat(withoutDates);
    }

    function getRangeStart(latestDate, rangeKey) {
        if (!latestDate) return null;
        const ms = 24 * 60 * 60 * 1000;
        switch(rangeKey) {
            case '1month': return new Date(latestDate.getTime() - 30 * ms);
            case '2weeks': return new Date(latestDate.getTime() - 14 * ms);
            case '1week': return new Date(latestDate.getTime() - 7 * ms);
            case 'fewdays': return new Date(latestDate.getTime() - 3 * ms);
            case '1day': return new Date(latestDate.getTime() - 1 * ms);
            case 'all':
            default:
                return null;
        }
    }

    function filterPointsByRange(points, rangeKey) {
        if (!points || points.length === 0) return [];
        const dates = points.map(p => p.date).filter(d => d != null);
        const latest = dates.length ? new Date(Math.max.apply(null, dates.map(d=>d.getTime()))) : null;
        const start = getRangeStart(latest, rangeKey);
        if (!start) return points;
        return points.filter(p => p.date && p.date >= start);
    }

    function buildLabelsValues(points, chartIdx) {
        // Filter datasets for this specific chart
        const allowedNames = chartDatasets[chartIdx] || [];
        const filteredDatasets = points.length > 0 
            ? Object.keys(points[0].values)
                .filter(key => allowedNames.some(allowed => key.toLowerCase().includes(allowed)))
                .map(key => ({
                    name: key,
                    data: points.map(p => p.values[key])
                }))
            : [];
        
        return {
            labels: points.map((p, i) => p.date ? formatDate(p.date) : p.label || `#${i+1}`),
            datasets: filteredDatasets
        };
    }

    function createOrUpdateChart(i, type, labels, datasets, datasetLabel) {
        const ctx = document.getElementById(canvasIds[i]).getContext('2d');
        if (charts[i]) {
            charts[i].destroy();
            charts[i] = null;
        }

        const colors = [
            { bg: 'rgba(54, 162, 235, 0.5)', border: 'rgba(54, 162, 235, 1)' },
            { bg: 'rgba(75, 192, 75, 0.5)', border: 'rgba(75, 192, 75, 1)' },
            { bg: 'rgba(255, 159, 64, 0.5)', border: 'rgba(255, 159, 64, 1)' },
            { bg: 'rgba(255, 99, 132, 0.5)', border: 'rgba(255, 99, 132, 1)' }
        ];

        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Chart ${i + 1}`,
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.parsed ? context.parsed.y ?? context.parsed : context.raw;
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        };

        const common = {
            data: {},
            options: Object.assign({}, baseOptions)
        };

        const chartMeta = chartUnits[i] || { yAxis: 'Value', defaultUnit: '' };
        common.options.plugins.title.text = `Chart ${i + 1} — ${chartMeta.yAxis}`;
        if (type === 'scatter') {
            const scatterDatasets = datasets.map((ds, dsIdx) => {
                const unit = getUnitForDataset(i, ds.name);
                return {
                    label: unit ? `${ds.name} (${unit})` : ds.name,
                    data: ds.data.map((v, idx) => ({ x: idx, y: v })),
                    backgroundColor: colors[dsIdx % colors.length].bg,
                    pointRadius: 5
                };
            });
            common.data = { datasets: scatterDatasets };
            common.options.scales = {
                x: {
                    title: { display: true, text: 'Index / Date' },
                    ticks: { callback: (val) => labels[val] || '' }
                },
                y: { beginAtZero: true, title: { display: true, text: chartMeta.yAxis } }
            };
        } else if (type === 'doughnut') {
            const ds = datasets[0] || { name: 'Data', data: [] };
            const unit = getUnitForDataset(i, ds.name);
            common.data = {
                labels,
                datasets: [{
                    label: unit ? `${ds.name} (${unit})` : ds.name,
                    data: ds.data,
                    backgroundColor: labels.map((_, k) => `hsl(${(k * 47) % 360} 70% 60%)`)
                }]
            };
            common.options.plugins.legend = { position: 'bottom' };
        } else {
            const datasetEntries = datasets.map((ds, dsIdx) => {
                const unit = getUnitForDataset(i, ds.name);
                return {
                    label: unit ? `${ds.name} (${unit})` : ds.name,
                    data: ds.data,
                    backgroundColor: colors[dsIdx % colors.length].bg,
                    borderColor: colors[dsIdx % colors.length].border,
                    borderWidth: 1,
                    tension: type === 'line' ? 0.3 : 0,
                    spanGaps: true
                };
            });
            common.data = { labels, datasets: datasetEntries };
            common.options.scales = {
                x: { title: { display: true, text: 'Date / Category' } },
                y: { beginAtZero: true, title: { display: true, text: chartMeta.yAxis } }
            };
        }

        charts[i] = new Chart(ctx, Object.assign({ type }, common));
    }

    function updateAllCharts() {
        const rangeKey = rangeSelect ? rangeSelect.value : 'all';
        const pts = filterPointsByRange(allPoints, rangeKey);

        for (let i = 0; i < canvasIds.length; i++) {
            const { labels, datasets } = buildLabelsValues(pts, i);
            const sel = chartTypeSelectors.find(s => Number(s.dataset.chart) === i);
            const type = sel ? sel.value : 'line';
            createOrUpdateChart(i, type, labels, datasets, '');
        }
    }

    function requestFullScreenForChart(chartIdx) {
        const chartItem = document.querySelector(`.chart-item[data-chart="${chartIdx}"]`);
        if (!chartItem) return;
        if (chartItem.requestFullscreen) {
            chartItem.requestFullscreen();
        } else if (chartItem.webkitRequestFullscreen) {
            chartItem.webkitRequestFullscreen();
        } else if (chartItem.mozRequestFullScreen) {
            chartItem.mozRequestFullScreen();
        } else if (chartItem.msRequestFullscreen) {
            chartItem.msRequestFullscreen();
        }
    }

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const rows = readWorkbookRows(workbook);
        allPoints = rowsToPoints(rows);
        updateAllCharts();
    });

    if (rangeSelect) rangeSelect.addEventListener('change', updateAllCharts);
    chartTypeSelectors.forEach(s => s.addEventListener('change', updateAllCharts));
    fullscreenButtons.forEach(btn => btn.addEventListener('click', () => requestFullScreenForChart(Number(btn.dataset.chart))));

    document.addEventListener('fullscreenchange', () => {
        document.querySelectorAll('.chart-item.fullscreen').forEach(el => el.classList.remove('fullscreen'));
        const fs = document.fullscreenElement;
        if (fs && fs.classList.contains('chart-item')) {
            fs.classList.add('fullscreen');
        }
    });
});
