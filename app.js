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

let weatherDataStore = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    fetchWeatherData();
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spinning');
        fetchWeatherData().finally(() => {
            setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
        });
    });

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderGrid();
        });
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
            // Kurz warten (100ms), um Open-Meteo Rate Limits bei schnellen Anfragen zu vermeiden
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=16`;
    
    try {
        const res = await fetch(url);
        
        // Bei HTTP 429 (Rate Limit) automatisch mit Verzögerung wiederholen
        if (res.status === 429 && retries > 0) {
            await new Promise(r => setTimeout(r, 400));
            return fetchForecastForTarget(target, retries - 1);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const daily = data.daily || {};
        const times = daily.time || [];
        const idx = times.indexOf(target.date);
        
        if (idx === -1) {
            return {
                ...target,
                available: false,
                reason: "Außerhalb des 16-Tage-Fensters"
            };
        }

        const code = daily.weathercode ? daily.weathercode[idx] : null;
        let meta;
        if (code === null) {
            meta = { text: "Noch keine Daten", icon: "⏳" };
        } else {
            meta = WEATHER_META[code] || { text: `Code ${code}`, icon: "❓" };
        }

        return {
            ...target,
            available: true,
            weatherCode: code,
            condition: meta.text,
            icon: meta.icon,
            tMax: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : null,
            tMin: daily.temperature_2m_min ? daily.temperature_2m_min[idx] : null,
            rainProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[idx] : null,
            rainSum: daily.precipitation_sum ? daily.precipitation_sum[idx] : null
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

    const filtered = weatherDataStore.filter(item => {
        if (currentFilter === 'hamburg') return item.region === 'hamburg';
        if (currentFilter === 'gb') return item.region === 'gb';
        if (currentFilter === 'available') return item.available === true;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="out-notice" style="grid-column: 1/-1;">Keine Stopps für diesen Filter gefunden.</div>`;
        return;
    }

    filtered.forEach(item => {
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

    const tMaxStr = item.tMax !== null ? `${item.tMax.toFixed(1)}°C` : '--';
    const tMinStr = item.tMin !== null ? `${item.tMin.toFixed(1)}°C` : '--';
    const rainProb = item.rainProb !== null ? item.rainProb : 0;
    const rainSumStr = item.rainSum !== null ? `${item.rainSum.toFixed(1)} mm` : '--';

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
                <div class="weather-icon-wrapper">${item.icon}</div>
                <div class="weather-desc">${item.condition}</div>
            </div>
            <div class="temp-box">
                <div class="temp-max">${tMaxStr}</div>
                <div class="temp-min">Min ${tMinStr}</div>
            </div>
        </div>

        <div class="card-metrics">
            <div class="metric-item">
                <span class="metric-icon">🌧️</span>
                <span>Regen: <strong>${rainProb}%</strong> (${rainSumStr})</span>
            </div>
            <div class="rain-bar-container" title="${rainProb}% Regenwahrscheinlichkeit">
                <div class="rain-bar-fill" style="width: ${Math.min(rainProb, 100)}%;"></div>
            </div>
        </div>
    `;

    return card;
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
