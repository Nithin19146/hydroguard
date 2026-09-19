/* HydroGuard demo data layer.
   Production: replace tickSensors with ultrasonic/radar gauges delivered over
   LoRaWAN/GSM, sendSMS with a provider such as Twilio, and forecast with a
   live weather API. */

const stations = [
    { id: 'HG-01', name: 'North Ridge', area: 'Upper channel', lat: 35.681, lon: -82.431, base: { velocity: 1.8, flow: 24, frequency: 11 }, current: {}, previous: 'normal', x: 25, y: 28 },
    { id: 'HG-02', name: 'Pine Hollow', area: 'East ravine', lat: 35.642, lon: -82.408, base: { velocity: 2.5, flow: 32, frequency: 9 }, current: {}, previous: 'normal', x: 70, y: 23 },
    { id: 'HG-03', name: 'Creek Bend', area: 'Main crossing', lat: 35.654, lon: -82.452, base: { velocity: 1.4, flow: 18, frequency: 13 }, current: {}, previous: 'normal', x: 47, y: 56 },
    { id: 'HG-04', name: 'Laurel Pass', area: 'South slope', lat: 35.615, lon: -82.435, base: { velocity: 2.1, flow: 27, frequency: 10 }, current: {}, previous: 'normal', x: 76, y: 73 },
    { id: 'HG-05', name: 'Fern Valley', area: 'West tributary', lat: 35.628, lon: -82.477, base: { velocity: 1.2, flow: 15, frequency: 15 }, current: {}, previous: 'normal', x: 18, y: 67 },
    { id: 'HG-06', name: 'Summit Gate', area: 'Headwater intake', lat: 35.706, lon: -82.462, base: { velocity: 2.8, flow: 38, frequency: 8 }, current: {}, previous: 'normal', x: 48, y: 13 }
];

const weather = [
    { day: 'TODAY', icon: '☁', rain: 42, temp: 19 }, { day: 'SAT 20', icon: '☂', rain: 68, temp: 17 },
    { day: 'SUN 21', icon: '☂', rain: 74, temp: 16 }, { day: 'MON 22', icon: '◒', rain: 35, temp: 20 }, { day: 'TUE 23', icon: '☀', rain: 18, temp: 22 }
];

const state = { moderate: 45, high: 70, radius: 15, user: { lat: 35.654, lon: -82.438 }, logs: [], tick: 0, audio: null };
const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const time = () => new Date().toLocaleTimeString([], { hour12: false });
const distanceKm = (a, b) => {
    const rad = Math.PI / 180; const dLat = (b.lat - a.lat) * rad; const dLon = (b.lon - a.lon) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

function riskFor(station) {
    const b = station.base; const c = station.current;
    const velocity = Math.max(0, c.velocity / b.velocity - 1);
    const flow = Math.max(0, c.flow / b.flow - 1);
    const frequency = Math.abs(c.frequency / b.frequency - 1);
    const rainModifier = Math.max(...weather.map((day) => day.rain)) / 100 * 7;
    return clamp(Math.round((velocity * 100 * .42) + (flow * 100 * .42) + (frequency * 100 * .16) + rainModifier), 0, 100);
}

function classification(score) { return score >= state.high ? 'high' : score >= state.moderate ? 'moderate' : 'normal'; }

function tickSensors() {
    state.tick += 1;
    stations.forEach((station, index) => {
        const surge = Math.sin(state.tick * .78 + index * 1.7) * .1 + Math.sin(state.tick * .27 + index) * .06;
        const eventPulse = (state.tick + index * 2) % 17 === 0 ? .34 : 0;
        station.current = {
            velocity: station.base.velocity * (1 + surge + eventPulse + Math.random() * .08),
            flow: station.base.flow * (1 + surge * 1.15 + eventPulse * 1.3 + Math.random() * .09),
            frequency: station.base.frequency * (1 + surge * .28 + (Math.random() - .5) * .07)
        };
        station.score = riskFor(station); station.level = classification(station.score);
        station.distance = distanceKm(state.user, station);
    });
    renderStations(); renderMap(); updateOverview(); checkAlerts();
    $('last-update').textContent = `Updated ${time()}`; $('banner-time').textContent = time();
}

function renderStations() {
    const selected = $('station-select').value;
    $('station-list').innerHTML = stations.filter((station) => selected === 'all' || station.id === selected).map((station, index) => `
        <div class="station-row ${selected === station.id ? 'selected' : ''}">
            <div class="station-name"><span class="station-index">${station.id}</span><div><strong>${station.name}</strong><small>${station.area}</small></div></div>
            <div class="risk-pill ${station.level}">${String(station.score).padStart(2, '0')} / ${station.level === 'normal' ? 'NORMAL' : station.level.toUpperCase()}</div>
            <div class="reading">${station.current.velocity.toFixed(2)} <em>BASE ${station.base.velocity.toFixed(2)} m/s</em></div>
            <div class="reading">${station.current.flow.toFixed(1)} <em>BASE ${station.base.flow.toFixed(0)} m³/s</em></div>
            <div class="reading">${station.current.frequency.toFixed(1)} <em>BASE ${station.base.frequency.toFixed(0)} Hz</em></div>
        </div>`).join('');
}

function renderMap() {
    $('map-stations').innerHTML = stations.map((station) => {
        const nearby = station.distance <= state.radius;
        return `<div class="map-station ${station.level} ${nearby ? '' : 'outside'}" style="left:${station.x}%;top:${station.y}%"><span class="map-pin"></span><label>${station.id} · ${station.distance.toFixed(1)}km</label></div>`;
    }).join('');
    const nearby = stations.filter((station) => station.distance <= state.radius).length;
    $('nearby-count').textContent = `${nearby} station${nearby === 1 ? '' : 's'} in range`;
    $('location-label').textContent = `${state.user.lat.toFixed(3)}° N / ${Math.abs(state.user.lon).toFixed(3)}° W`;
}

function updateOverview() {
    const active = stations.filter((station) => station.level !== 'normal' && station.distance <= state.radius).length;
    $('alert-count').textContent = String(active).padStart(2, '0'); $('radius-readout').textContent = state.radius; $('map-radius').textContent = `${state.radius} km`;
    const high = stations.some((station) => station.level === 'high' && station.distance <= state.radius);
    $('status-banner').classList.toggle('critical', high);
    $('banner-title').textContent = high ? 'PROXIMITY ALERT ACTIVE' : 'MONITORING ACTIVE';
    $('banner-copy').textContent = high ? 'High-risk surge signature detected within your configured radius.' : 'Sensor mesh is connected. Simulated readings refresh every 3 seconds.';
}

function addLog(station, type, message, quiet = false) {
    const entry = { time: time(), type, message, quiet };
    state.logs.unshift(entry); state.logs = state.logs.slice(0, 20);
    $('event-log').innerHTML = state.logs.map((log) => `<div class="event-item"><span class="event-time">${log.time}</span><i class="event-mark ${log.type}"></i><div><strong>${log.message}</strong><p>${log.quiet ? 'Regional watch · outside alert radius' : `SMS relay simulated · ${station ? station.id : 'network'}`}</p></div><span class="event-type">${log.quiet ? 'WATCH' : log.type.toUpperCase()}</span></div>`).join('');
}

function checkAlerts() {
    stations.forEach((station) => {
        const nearby = station.distance <= state.radius;
        if (station.level !== 'normal' && station.previous === 'normal') {
            if (nearby) { addLog(station, station.level, `${station.name} crossed ${station.level} threshold`); interrupt(station); }
            else addLog(station, station.level, `${station.name} risk ${station.score}/100 detected`, true);
        }
        station.previous = station.level;
    });
}

function interrupt(station) {
    $('flash-overlay').classList.remove('active'); void $('flash-overlay').offsetWidth; $('flash-overlay').classList.add('active');
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    try { state.audio ||= new (window.AudioContext || window.webkitAudioContext)(); const oscillator = state.audio.createOscillator(); const gain = state.audio.createGain(); oscillator.frequency.value = 660; gain.gain.value = .06; oscillator.connect(gain); gain.connect(state.audio.destination); oscillator.start(); oscillator.stop(state.audio.currentTime + .22); } catch (_) { /* browser may require a user gesture for sound */ }
    showToast(`ALERT: ${station.name} is ${station.level.toUpperCase()}`);
}

function showToast(text) { const toast = $('toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3400); }
function locate() {
    if (!navigator.geolocation) return fallbackLocation('GPS unavailable; using manual fallback location.');
    navigator.geolocation.getCurrentPosition((position) => { state.user = { lat: position.coords.latitude, lon: position.coords.longitude }; tickSensors(); showToast('Device location connected'); }, () => fallbackLocation('Location permission denied; using manual fallback location.'));
}
function fallbackLocation(message) { state.user = { lat: 35.654, lon: -82.438 }; tickSensors(); showToast(message); }

function setup() {
    $('station-select').innerHTML += stations.map((station) => `<option value="${station.id}">${station.id} — ${station.name}</option>`).join('');
    $('forecast-strip').innerHTML = weather.map((day) => `<div class="forecast-day"><strong>${day.day}</strong><div class="forecast-icon">${day.icon}</div><span class="rain">${day.rain}% <small>RAIN</small></span><span class="temp">${day.temp}°C</span></div>`).join('');
    $('moderate-threshold').oninput = (event) => { state.moderate = +event.target.value; $('moderate-output').textContent = state.moderate; tickSensors(); };
    $('high-threshold').oninput = (event) => { state.high = +event.target.value; $('high-output').textContent = state.high; tickSensors(); };
    $('radius-input').oninput = (event) => { state.radius = +event.target.value; $('radius-output').textContent = state.radius; tickSensors(); };
    $('station-select').onchange = renderStations; $('clear-log').onclick = () => { state.logs = []; $('event-log').innerHTML = ''; };
    $('locate-button').onclick = locate; $('gps-button').onclick = locate;
    $('theme-toggle').onclick = () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; };
    setInterval(() => { $('clock').textContent = time(); }, 1000); setInterval(tickSensors, 3000);
    tickSensors(); addLog(null, 'normal', 'HydroGuard monitoring session started');
}

setup();
