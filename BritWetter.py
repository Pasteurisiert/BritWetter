import time
import requests
from collections import Counter

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

def get_forecast_slot(hourly, target_date, min_hour, max_hour):
    times = hourly.get("time", [])
    indices = []
    for i, t in enumerate(times):
        if t.startswith(target_date):
            hour = int(t.split("T")[1].split(":")[0])
            if min_hour <= hour <= max_hour:
                indices.append(i)
    if not indices:
        return None

    temps = [hourly.get("temperature_2m", [])[i] for i in indices if i < len(hourly.get("temperature_2m", [])) and hourly.get("temperature_2m", [])[i] is not None]
    probs = [hourly.get("precipitation_probability", [])[i] for i in indices if i < len(hourly.get("precipitation_probability", [])) and hourly.get("precipitation_probability", [])[i] is not None]
    rains = [hourly.get("precipitation", [])[i] for i in indices if i < len(hourly.get("precipitation", [])) and hourly.get("precipitation", [])[i] is not None]
    codes = [hourly.get("weathercode", [])[i] for i in indices if i < len(hourly.get("weathercode", [])) and hourly.get("weathercode", [])[i] is not None]
    winds = [hourly.get("wind_speed_10m", [])[i] for i in indices if i < len(hourly.get("wind_speed_10m", [])) and hourly.get("wind_speed_10m", [])[i] is not None]
    gusts = [hourly.get("wind_gusts_10m", [])[i] for i in indices if i < len(hourly.get("wind_gusts_10m", [])) and hourly.get("wind_gusts_10m", [])[i] is not None]

    if codes:
        severe = [c for c in codes if c >= 50]
        if severe:
            code = max(severe)
        else:
            code = Counter(codes).most_common(1)[0][0]
        condition = WEATHER_CODES.get(code, f"Code {code}")
    else:
        condition = "Noch keine Daten"

    t_max = fmt_val(max(temps) if temps else None, "°C")
    t_min = fmt_val(min(temps) if temps else None, "°C")
    prob = fmt_val(max(probs) if probs else None, "%", decimals=0)
    rain = fmt_val(sum(rains) if rains else None, " mm")
    wind_max = fmt_val(max(winds) if winds else None, " km/h", decimals=0)
    gust_max = max(gusts) if gusts else None

    wind_str = wind_max
    if gust_max is not None and winds and gust_max > max(winds) + 5:
        wind_str += f" (Böen {int(gust_max)} km/h)"

    return f"{condition:<18} | {t_max:>6} / {t_min:<6} | Regen: {prob:>4} ({rain}) | Wind: {wind_str}"

def get_forecast(lat, lon, target_date, slot="8-12", retries=2):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "weathercode",
            "wind_speed_10m",
            "wind_gusts_10m"
        ],
        "wind_speed_unit": "kmh",
        "timezone": "auto",
        "forecast_days": 16
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 429 and retries > 0:
            time.sleep(0.4)
            return get_forecast(lat, lon, target_date, slot=slot, retries=retries-1)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"Verbindungsfehler: {e}"

    hourly = data.get("hourly", {})
    slots_map = {
        "8-12": (8, 12),
        "12-16": (12, 16),
        "16-20": (16, 20),
        "8-20": (8, 20),
        "24h": (0, 23)
    }
    min_h, max_h = slots_map.get(slot, (8, 12))
    res = get_forecast_slot(hourly, target_date, min_h, max_h)
    if res is None:
        return "Datum liegt noch außerhalb des 16-Tage-Fensters."
    return res

print(f"{'Ort':<12} | {'Datum':<10} | {'Wetter (8-12h)':<18} | {'Temp (Max/Min)':<15} | {'Niederschlag (8-12h)':<22} | {'Wind (km/h)'}")
print("-" * 110)

for item in TARGETS:
    res = get_forecast(item["lat"], item["lon"], item["date"], slot="8-12")
    print(f"{item['city']:<12} | {item['date']:<10} | {res}")
    time.sleep(0.1)
