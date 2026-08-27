const TARGETS = [
    { city: "Hamburg", country: "DE", lat: 53.5511, lon: 9.9937, date: "2026-09-02", region: "hamburg" },
    { city: "Hamburg", country: "DE", lat: 53.5511, lon: 9.9937, date: "2026-09-03", region: "hamburg" },
    { city: "Cork", country: "IE", lat: 51.8985, lon: -8.4756, date: "2026-09-05", region: "gb" },
    { city: "Dublin", country: "IE", lat: 53.3498, lon: -6.2603, date: "2026-09-06", region: "gb" },
    { city: "Belfast", country: "UK", lat: 54.5973, lon: -5.9301, date: "2026-09-07", region: "gb" },
    { city: "Glasgow", country: "UK", lat: 55.8642, lon: -4.2518, date: "2026-09-08", region: "gb" },
    { city: "Kirkwall", country: "UK", lat: 58.9809, lon: -2.9605, date: "2026-09-10", region: "gb" },
    { city: "Invergordon", country: "UK", lat: 57.6896, lon: -4.1685, date: "2026-09-11", region: "gb" },
    { city: "Hamburg", country: "DE", lat: 53.5511, lon: 9.9937, date: "2026-09-13", region: "hamburg" },
];

const WEATHER_META = {
    0: { text: "Klar", icon: "☀️" },
    1: { text: "Meist sonnig", icon: "🌤️" },
    2: { text: "Teilweise bewölkt", icon: "⛅" },
    3: { text: "Bedeckt", icon: "☁️" },
    45: { text: "Nebel", icon: "🌫️" },
    48: { text: "Reifnebel", icon: "🌫️" },
    51: { text: "Leichter Niesel", icon: "🌦️" },
    53: { text: "Nieselregen", icon: "🌧️" },
    55: { text: "Starker Niesel", icon: "🌧️" },
    56: { text: "Gefrier-Niesel", icon: "🌧️" },
    57: { text: "Gefrier-Niesel", icon: "🌧️" },
    61: { text: "Leichter Regen", icon: "🌧️" },
    63: { text: "Mäßiger Regen", icon: "🌧️" },
    65: { text: "Starker Regen", icon: "🌧️" },
    66: { text: "Gefrierregen", icon: "🌧️" },
    67: { text: "Gefrierregen", icon: "🌧️" },
    71: { text: "Leichter Schneefall", icon: "❄️" },
    73: { text: "Mäßiger Schneefall", icon: "❄️" },
    75: { text: "Starker Schneefall", icon: "❄️" },
    77: { text: "Schneegriesel", icon: "❄️" },
    80: { text: "Leichte Schauer", icon: "🌦️" },
    81: { text: "Regenschauer", icon: "🌧️" },
    82: { text: "Starke Schauer", icon: "🌧️" },
    85: { text: "Schneeschauer", icon: "🌨️" },
    86: { text: "Schneeschauer", icon: "🌨️" },
    95: { text: "Gewitter", icon: "⛈️" },
    96: { text: "Gewitter + Hagel", icon: "⛈️" },
    99: { text: "Schweres Gewitter", icon: "⛈️" }
};

const COUNTRY_FLAGS = {
    "DE": "🇩🇪",
    "IE": "🇮🇪",
    "UK": "🇬🇧"
};

const TIME_SLOTS = {
    '8-12': { label: '☀️ 8–12 Uhr', minHour: 8, maxHour: 12 },
    '12-16': { label: '🌤️ 12–16 Uhr', minHour: 12, maxHour: 16 },
    '16-20': { label: '🌅 16–20 Uhr', minHour: 16, maxHour: 20 },
    '8-20': { label: '📊 8–20 Uhr', minHour: 8, maxHour: 20 },
    '24h': { label: '🌙 24 Std.', minHour: 0, maxHour: 23 }
};

let weatherDataStore = [];
let currentFilter = 'all';
let currentTimeMode = '8-12';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    fetchWeatherData();
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            fetchWeatherData().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
            });
        });
    }

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-pill');
            if (!button) return;
            filterPills.forEach(p => p.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.getAttribute('data-filter');
            renderGrid();
        });
    });

    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = e.target.closest('.toggle-btn');
            if (!button) return;
            toggleBtns.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            currentTimeMode = button.getAttribute('data-time');
            renderGrid();
        });
    });

    // Modal close listeners
    const modal = document.getElementById('trend-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTrendModal);
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeTrendModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeTrendModal();
    });
}

async function fetchWeatherData() {
    showLoader(true);
    weatherDataStore = [];

    try {
        const results = [];
        for (const item of TARGETS) {
            const data = await fetchForecastForTarget(item);
            results.push(data);
            await new Promise(r => setTimeout(r, 100));
        }
        weatherDataStore = results;
        renderGrid();
    } catch (err) {
        console.error('Fehler beim Laden der Wetterdaten:', err);
    } finally {
        showLoader(false);
    }
}

async function fetchForecastForTarget(target, retries = 2) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto&forecast_days=16`;
    
    try {
        const res = await fetch(url);
        
        if (res.status === 429 && retries > 0) {
            await new Promise(r => setTimeout(r, 400));
            return fetchForecastForTarget(target, retries - 1);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const hourly = data.hourly || {};
        const times = hourly.time || [];
        
        const dayIndices = [];
        for (let i = 0; i < times.length; i++) {
            if (times[i].startsWith(target.date)) {
                dayIndices.push(i);
            }
        }

        if (dayIndices.length === 0) {
            return {
                ...target,
                available: false,
                reason: "Außerhalb des 16-Tage-Fensters"
            };
        }

        const hourlyDetails = dayIndices.map(i => ({
            time: times[i],
            hour: parseInt(times[i].split('T')[1].split(':')[0], 10),
            hourStr: times[i].split('T')[1],
            temp: hourly.temperature_2m?.[i],
            rainProb: hourly.precipitation_probability?.[i],
            rainSum: hourly.precipitation?.[i],
            weatherCode: hourly.weathercode?.[i],
            windSpeed: hourly.wind_speed_10m?.[i],
            windGusts: hourly.wind_gusts_10m?.[i]
        }));

        function calcStats(indices) {
            if (!indices.length) return null;
            const temps = indices.map(i => hourly.temperature_2m?.[i]).filter(v => v != null);
            const rainProbs = indices.map(i => hourly.precipitation_probability?.[i]).filter(v => v != null);
            const rainSums = indices.map(i => hourly.precipitation?.[i]).filter(v => v != null);
            const codes = indices.map(i => hourly.weathercode?.[i]).filter(v => v != null);
            const winds = indices.map(i => hourly.wind_speed_10m?.[i]).filter(v => v != null);
            const gusts = indices.map(i => hourly.wind_gusts_10m?.[i]).filter(v => v != null);

            let code = null;
            if (codes.length) {
                const severe = codes.filter(c => c >= 50);
                if (severe.length) {
                    code = Math.max(...severe);
                } else {
                    const counts = {};
                    codes.forEach(c => counts[c] = (counts[c] || 0) + 1);
                    code = parseInt(Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b), 10);
                }
            }

            const meta = code !== null ? (WEATHER_META[code] || { text: `Code ${code}`, icon: "❓" }) : { text: "Keine Daten", icon: "⏳" };

            return {
                weatherCode: code,
                condition: meta.text,
                icon: meta.icon,
                tMax: temps.length ? Math.max(...temps) : null,
                tMin: temps.length ? Math.min(...temps) : null,
                rainProb: rainProbs.length ? Math.max(...rainProbs) : null,
                rainSum: rainSums.length ? rainSums.reduce((a, b) => a + b, 0) : null,
                windMax: winds.length ? Math.max(...winds) : null,
                windGustsMax: gusts.length ? Math.max(...gusts) : null
            };
        }

        const slotsData = {};
        Object.keys(TIME_SLOTS).forEach(slotKey => {
            const slot = TIME_SLOTS[slotKey];
            const slotIndices = dayIndices.filter(i => {
                const hour = parseInt(times[i].split('T')[1].split(':')[0], 10);
                return hour >= slot.minHour && hour <= slot.maxHour;
            });
            slotsData[slotKey] = calcStats(slotIndices);
        });

        return {
            ...target,
            available: true,
            slots: slotsData,
            hourlyDetails
        };

    } catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 400));
            return fetchForecastForTarget(target, retries - 1);
        }

        return {
            ...target,
            available: false,
            reason: `Fehler: ${err.message}`
        };
    }
}

function renderGrid() {
    const grid = document.getElementById('weather-grid');
    grid.innerHTML = '';

    if (weatherDataStore.length === 0) {
        grid.innerHTML = `<div class="out-notice" style="grid-column: 1/-1;">Keine Stopps gefunden.</div>`;
        return;
    }

    weatherDataStore.forEach(item => {
        const card = createWeatherCard(item);
        grid.appendChild(card);
    });
}

function createWeatherCard(item) {
    const card = document.createElement('div');
    card.className = `weather-card ${!item.available ? 'out-of-range' : ''}`;

    const formattedDate = formatDateString(item.date);
    const flag = COUNTRY_FLAGS[item.country] || '📍';

    if (!item.available) {
        card.innerHTML = `
            <div class="card-header">
                <div class="city-badge">
                    <span class="city-flag">${flag}</span>
                    <span class="city-name">${item.city}</span>
                </div>
                <div class="date-pill">${formattedDate}</div>
            </div>
            <div class="out-notice">
                ⏳ ${item.reason || 'Datum liegt noch außerhalb des 16-Tage-Fensters'}
            </div>
        `;
        return card;
    }

    const stats = (item.slots && item.slots[currentTimeMode]) || (item.slots && item.slots['8-12']) || (item.slots && item.slots['24h']);

    const tMaxStr = stats && stats.tMax !== null ? `${stats.tMax.toFixed(1)}°C` : '--';
    const tMinStr = stats && stats.tMin !== null ? `${stats.tMin.toFixed(1)}°C` : '--';
    const rainProb = stats && stats.rainProb !== null ? stats.rainProb : 0;
    const rainSumStr = stats && stats.rainSum !== null ? `${stats.rainSum.toFixed(1)} mm` : '--';
    const windStr = stats && stats.windMax !== null ? `${Math.round(stats.windMax)} km/h` : '--';
    const windGustsStr = (stats && stats.windGustsMax !== null && stats.windGustsMax > stats.windMax + 5) 
        ? `${Math.round(stats.windGustsMax)} km/h` 
        : null;

    const conditionText = stats ? stats.condition : 'Unbekannt';
    const iconSymbol = stats ? stats.icon : '❓';

    card.innerHTML = `
        <div class="card-header">
            <div class="city-badge">
                <span class="city-flag">${flag}</span>
                <span class="city-name">${item.city}</span>
            </div>
            <div class="date-pill">${formattedDate}</div>
        </div>

        <div class="card-body">
            <div class="weather-info">
                <div class="weather-icon-wrapper">${iconSymbol}</div>
                <div class="weather-desc">${conditionText}</div>
            </div>
            <div class="temp-box">
                <div class="temp-max">${tMaxStr}</div>
                <div class="temp-min">Min ${tMinStr}</div>
            </div>
        </div>

        <div class="card-metrics">
            <div class="metric-row">
                <div class="metric-item">
                    <span class="metric-icon">🌧️</span>
                    <span>Regen: <strong>${rainProb}%</strong> (${rainSumStr})</span>
                </div>
                <div class="rain-bar-container" title="${rainProb}% Regenwahrscheinlichkeit">
                    <div class="rain-bar-fill" style="width: ${Math.min(rainProb, 100)}%;"></div>
                </div>
            </div>
            <div class="metric-row wind-row">
                <div class="metric-item">
                    <span class="metric-icon">💨</span>
                    <span>Wind: <strong>${windStr}</strong> ${windGustsStr ? `<span class="gusts-badge">Böen ${windGustsStr}</span>` : ''}</span>
                </div>
            </div>
        </div>

        <div class="card-click-hint">
            <span>📈 Trendgraph anzeigen</span> &rarr;
        </div>
    `;

    card.addEventListener('click', () => {
        openTrendModal(item);
    });

    return card;
}

function openTrendModal(item) {
    const modal = document.getElementById('trend-modal');
    if (!modal) return;

    const flag = COUNTRY_FLAGS[item.country] || '📍';
    const formattedDate = formatDateStringFull(item.date);
    const dayStats = item.slots ? item.slots['24h'] : null;

    document.getElementById('modal-city-flag').textContent = flag;
    document.getElementById('modal-city-name').textContent = item.city;
    document.getElementById('modal-date-text').textContent = formattedDate;

    if (dayStats) {
        document.getElementById('modal-summary-temp').textContent = `${dayStats.icon} Max ${dayStats.tMax?.toFixed(1)}°C / Min ${dayStats.tMin?.toFixed(1)}°C`;
        document.getElementById('modal-summary-rain').textContent = `🌧️ ${dayStats.rainProb}% (${dayStats.rainSum?.toFixed(1)} mm)`;
        document.getElementById('modal-summary-wind').textContent = `💨 Max ${Math.round(dayStats.windMax || 0)} km/h`;
    }

    // Render Trend Graph SVG
    const chartWrapper = document.getElementById('chart-wrapper');
    if (chartWrapper && item.hourlyDetails) {
        chartWrapper.innerHTML = generateTrendSVG(item.hourlyDetails);
    }

    // Render Hourly Grid
    const hourlyGrid = document.getElementById('hourly-table');
    if (hourlyGrid && item.hourlyDetails) {
        hourlyGrid.innerHTML = '';
        item.hourlyDetails.forEach(h => {
            const icon = h.weatherCode !== null ? (WEATHER_META[h.weatherCode]?.icon || '❓') : '⏳';
            const cardEl = document.createElement('div');
            cardEl.className = 'hourly-card';
            cardEl.innerHTML = `
                <div class="hourly-time">${h.hourStr}</div>
                <div class="hourly-icon">${icon}</div>
                <div class="hourly-temp">${h.temp !== null ? h.temp.toFixed(1) + '°' : '--'}</div>
                <div class="hourly-rain">${h.rainProb || 0}% (${h.rainSum ? h.rainSum.toFixed(1) : '0'}mm)</div>
            `;
            hourlyGrid.appendChild(cardEl);
        });
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeTrendModal() {
    const modal = document.getElementById('trend-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.body.style.overflow = '';
}

function generateTrendSVG(hourlyList) {
    if (!hourlyList || !hourlyList.length) return '<p>Keine Stundendaten vorhanden.</p>';

    const svgWidth = 720;
    const svgHeight = 220;
    const paddingLeft = 35;
    const paddingRight = 35;
    const paddingTop = 35;
    const paddingBottom = 45;

    const graphW = svgWidth - paddingLeft - paddingRight;
    const graphH = svgHeight - paddingTop - paddingBottom;

    const temps = hourlyList.map(d => d.temp).filter(v => v != null);
    const rainSums = hourlyList.map(d => d.rainSum).filter(v => v != null);
    const rainProbs = hourlyList.map(d => d.rainProb).filter(v => v != null);

    let minT = Math.min(...temps);
    let maxT = Math.max(...temps);
    if (minT === maxT) { minT -= 1; maxT += 1; }
    const tempRange = maxT - minT;

    const maxRainSum = Math.max(...rainSums, 1);

    const n = hourlyList.length;
    const stepX = graphW / (n - 1);

    // Rain Bars
    let barsSVG = '';
    for (let i = 0; i < n; i++) {
        const d = hourlyList[i];
        const x = paddingLeft + i * stepX;
        const rVal = d.rainSum || 0;
        const rProb = d.rainProb || 0;
        
        let barH = 0;
        if (rVal > 0) {
            barH = Math.min(graphH * 0.75, (rVal / maxRainSum) * (graphH * 0.65) + 8);
        } else if (rProb > 0) {
            barH = (rProb / 100) * (graphH * 0.4);
        }

        if (barH > 0) {
            const barW = Math.max(6, stepX * 0.55);
            const barX = x - barW / 2;
            const barY = paddingTop + graphH - barH;
            
            barsSVG += `
                <rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" 
                      rx="3" fill="url(#rainGrad)" opacity="0.85">
                    <title>${d.hourStr} Uhr: ${rVal.toFixed(1)} mm (${rProb}% Regenwahrscheinlichkeit)</title>
                </rect>
            `;
            
            if (rVal >= 0.2 || rProb >= 40) {
                const labelText = rVal > 0 ? `${rVal.toFixed(1)}m` : `${rProb}%`;
                barsSVG += `
                    <text x="${x.toFixed(1)}" y="${(barY - 4).toFixed(1)}" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="600">${labelText}</text>
                `;
            }
        }
    }

    // Temp Points
    const points = [];
    for (let i = 0; i < n; i++) {
        const d = hourlyList[i];
        const x = paddingLeft + i * stepX;
        const y = paddingTop + graphH - ((d.temp - minT) / tempRange) * (graphH * 0.75) - 10;
        points.push({ x, y, temp: d.temp, hour: d.hour, icon: d.weatherCode !== null ? (WEATHER_META[d.weatherCode]?.icon || '') : '' });
    }

    let dLine = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
        const pPrev = points[i - 1];
        const pCurr = points[i];
        const cpX1 = pPrev.x + stepX * 0.4;
        const cpY1 = pPrev.y;
        const cpX2 = pCurr.x - stepX * 0.4;
        const cpY2 = pCurr.y;
        dLine += ` C ${cpX1.toFixed(1)} ${cpY1.toFixed(1)}, ${cpX2.toFixed(1)} ${cpY2.toFixed(1)}, ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)}`;
    }

    const dArea = `${dLine} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + graphH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingTop + graphH).toFixed(1)} Z`;

    let pointsSVG = '';
    let xLabelsSVG = '';

    for (let i = 0; i < n; i++) {
        const pt = points[i];
        const showLabel = (i % 2 === 0 || i === n - 1);
        
        if (showLabel) {
            pointsSVG += `
                <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.5" fill="#6366f1" stroke="#ffffff" stroke-width="2"/>
                <text x="${pt.x.toFixed(1)}" y="${(pt.y - 8).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700">${pt.temp.toFixed(1)}°</text>
            `;

            xLabelsSVG += `
                <text x="${pt.x.toFixed(1)}" y="${(paddingTop + graphH + 18).toFixed(1)}" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="600">${pt.hour < 10 ? '0' + pt.hour : pt.hour}:00</text>
                <text x="${pt.x.toFixed(1)}" y="${(paddingTop + graphH + 34).toFixed(1)}" text-anchor="middle" font-size="12">${pt.icon}</text>
            `;
        }
    }

    return `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="auto" style="overflow: visible;">
            <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.45"/>
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
                </linearGradient>
                <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0.5"/>
                </linearGradient>
            </defs>

            <line x1="${paddingLeft}" y1="${paddingTop + graphH}" x2="${svgWidth - paddingRight}" y2="${paddingTop + graphH}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

            ${barsSVG}

            <path d="${dArea}" fill="url(#tempGrad)"/>
            <path d="${dLine}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round"/>

            ${pointsSVG}
            ${xLabelsSVG}
        </svg>
    `;
}

function formatDateString(isoStr) {
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    const dayName = days[d.getDay()];
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthName = months[d.getMonth()];

    return `${dayName}, ${dayNum}. ${monthName}`;
}

function formatDateStringFull(isoStr) {
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    const dayName = days[d.getDay()];
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();

    return `${dayName}, ${dayNum}. ${monthName} ${year}`;
}

function showLoader(visible) {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('weather-grid');

    if (visible) {
        loader.classList.remove('hidden');
        grid.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        grid.classList.remove('hidden');
    }
}
