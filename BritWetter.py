import time
import requests

TARGETS = [
    {"city": "Hamburg", "lat": 53.5511, "lon": 9.9937, "date": "2026-09-02"},
    {"city": "Hamburg", "lat": 53.5511, "lon": 9.9937, "date": "2026-09-03"},
    {"city": "Cork", "lat": 51.8985, "lon": -8.4756, "date": "2026-09-05"},
    {"city": "Dublin", "lat": 53.3498, "lon": -6.2603, "date": "2026-09-06"},
    {"city": "Belfast", "lat": 54.5973, "lon": -5.9301, "date": "2026-09-07"},
    {"city": "Glasgow", "lat": 55.8642, "lon": -4.2518, "date": "2026-09-08"},
    {"city": "Kirkwall", "lat": 58.9809, "lon": -2.9605, "date": "2026-09-10"},
    {"city": "Invergordon", "lat": 57.6896, "lon": -4.1685, "date": "2026-09-11"},
    {"city": "Hamburg", "lat": 53.5511, "lon": 9.9937, "date": "2026-09-13"},
]

WEATHER_CODES = {
    0: "Klar", 1: "Meist sonnig", 2: "Teilweise bewölkt", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel", 51: "Leichter Niesel", 53: "Nieselregen",
    55: "Starker Niesel", 56: "Gefrier-Niesel 1", 57: "Gefrier-Niesel 2",
    61: "Leichter Regen", 63: "Mäßiger Regen", 65: "Starker Regen",
    66: "Gefrierregen 1", 67: "Gefrierregen 2", 71: "Leichter Schnee",
    73: "Mäßiger Schnee", 75: "Starker Schnee", 77: "Schneegriesel",
    80: "Leichte Schauer", 81: "Regenschauer", 82: "Starke Schauer",
    85: "Schneeschauer 1", 86: "Schneeschauer 2", 95: "Gewitter",
    96: "Gewitter + Hagel", 99: "Schweres Gewitter"
}

def fmt_val(val, unit="", decimals=1):
    """Sichere Formatierung für None-Werte."""
    if val is None:
        return "--"
    if decimals == 0:
        return f"{int(val)}{unit}"
    return f"{val:.{decimals}f}{unit}"

def get_forecast(lat, lon, target_date, retries=2):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": [
            "weathercode",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max"
        ],
        "timezone": "auto",
        "forecast_days": 16
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 429 and retries > 0:
            time.sleep(0.4)
            return get_forecast(lat, lon, target_date, retries=retries-1)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"Verbindungsfehler: {e}"

    daily = data.get("daily", {})
    times = daily.get("time", [])
    
    if target_date not in times:
        return "Datum liegt noch außerhalb des 16-Tage-Fensters."

    idx = times.index(target_date)
    
    # Werte sicher extrahieren (können am Rand des Vorhersagezeitraums None sein)
    code = daily.get("weathercode", [None])[idx]
    if code is None:
        condition = "Noch keine Daten"
    else:
        condition = WEATHER_CODES.get(code, f"Code {code}")
    
    t_max = fmt_val(daily.get("temperature_2m_max", [None])[idx], "°C")
    t_min = fmt_val(daily.get("temperature_2m_min", [None])[idx], "°C")
    prob = fmt_val(daily.get("precipitation_probability_max", [None])[idx], "%", decimals=0)
    rain = fmt_val(daily.get("precipitation_sum", [None])[idx], " mm")

    return f"{condition:<18} | {t_max:>6} / {t_min:<6} | Regen: {prob:>4} ({rain})"

print(f"{'Ort':<12} | {'Datum':<10} | {'Wetter':<18} | {'Temp (Max/Min)':<15} | {'Niederschlag'}")
print("-" * 80)

for item in TARGETS:
    res = get_forecast(item["lat"], item["lon"], item["date"])
    print(f"{item['city']:<12} | {item['date']:<10} | {res}")
    time.sleep(0.1)  # Kleine Pause, um Ratenbeschränkungen zu vermeiden
