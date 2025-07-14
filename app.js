// App State
let isTracking = false;
let startTime = null;
let totalDistance = 0;
let currentSpeed = 0;
let routePoints = [];
let lastCoords = null;
let watchId = null;
let timerInterval = null;
let speedHistory = [];

// DOM Elements
const canvas = document.getElementById('routeCanvas');
const ctx = canvas.getContext('2d');
const canvasOverlay = document.getElementById('canvasOverlay');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const durationEl = document.getElementById('duration');
const networkAlert = document.getElementById('networkAlert');
const workoutSummary = document.getElementById('workoutSummary');
const toast = document.getElementById('toast');

// Initialize Canvas
function initCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

// Convert lat/lon to canvas x/y (naive projection for small distances)
function latLonToXY(lat, lon, baseLat, baseLon) {
    const R = 6371e3; // Earth radius in meters
    const x = R * (lon - baseLon) * Math.cos((lat + baseLat) * Math.PI / 360);
    const y = R * (lat - baseLat);
    return { x: x / 10 + canvas.width / 2, y: canvas.height / 2 - y / 10 };
}

function drawRoute() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (routePoints.length < 2) return;

    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(routePoints[0].x, routePoints[0].y);
    for (let i = 1; i < routePoints.length; i++) {
        ctx.lineTo(routePoints[i].x, routePoints[i].y);
    }
    ctx.stroke();

    // Start point
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(routePoints[0].x, routePoints[0].y, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Current point
    const last = routePoints[routePoints.length - 1];
    ctx.fillStyle = '#f44336';
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, 2 * Math.PI);
    ctx.fill();
}

function updateStats() {
    distanceEl.textContent = totalDistance.toFixed(2);
    speedEl.textContent = currentSpeed.toFixed(1);
    if (startTime) {
        const elapsed = Date.now() - startTime;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        durationEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

function startTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
    }
    isTracking = true;
    startTime = Date.now();
    totalDistance = 0;
    currentSpeed = 0;
    routePoints = [];
    lastCoords = null;
    speedHistory = [];

    startBtn.disabled = true;
    stopBtn.disabled = false;
    canvasOverlay.style.display = 'none';
    workoutSummary.classList.remove('show');

    watchId = navigator.geolocation.watchPosition(handlePositionUpdate, handleError, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
    });

    timerInterval = setInterval(updateStats, 1000);
    showToast('Tracking started!');
}

function handlePositionUpdate(position) {
    const { latitude, longitude, timestamp } = position.coords;
    if (!lastCoords) lastCoords = { lat: latitude, lon: longitude, timestamp };

    const distance = haversineDistance(lastCoords.lat, lastCoords.lon, latitude, longitude);
    totalDistance += distance;
    const timeDiff = (timestamp - lastCoords.timestamp) / 1000;

    if (timeDiff > 0) {
        currentSpeed = (distance / timeDiff) * 3.6; // m/s to km/h
        speedHistory.push(currentSpeed);
        if (speedHistory.length > 10) speedHistory.shift();
    }

    const base = routePoints.length > 0 ? routePoints[0].original : { lat: latitude, lon: longitude };
    const point = latLonToXY(latitude, longitude, base.lat, base.lon);
    point.original = { lat: latitude, lon: longitude };
    routePoints.push(point);

    lastCoords = { lat: latitude, lon: longitude, timestamp };
    drawRoute();
    updateStats();
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function stopTracking() {
    isTracking = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    canvasOverlay.style.display = 'block';
    canvasOverlay.textContent = 'Workout completed';

    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (timerInterval) clearInterval(timerInterval);

    showWorkoutSummary();
    saveWorkoutOffline();
    showToast('Data saved offline. Will sync when online.');
}

function showWorkoutSummary() {
    const avgSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length || 0;
    const calories = Math.round(totalDistance / 1000 * 60);
    const duration = Date.now() - startTime;
    const h = Math.floor(duration / 3600000);
    const m = Math.floor((duration % 3600000) / 60000);
    const s = Math.floor((duration % 60000) / 1000);

    document.getElementById('summaryDistance').textContent = `${(totalDistance / 1000).toFixed(2)} km`;
    document.getElementById('summaryAvgSpeed').textContent = `${avgSpeed.toFixed(1)} km/h`;
    document.getElementById('summaryCalories').textContent = calories.toString();
    document.getElementById('summaryDuration').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    workoutSummary.classList.add('show');
}

function saveWorkoutOffline() {
    const data = {
        timestamp: new Date().toISOString(),
        distance: totalDistance,
        duration: Date.now() - startTime,
        avgSpeed: speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length || 0
    };
    const saved = JSON.parse(localStorage.getItem('workouts') || '[]');
    saved.push(data);
    localStorage.setItem('workouts', JSON.stringify(saved));
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!isOnline) {
        networkAlert.classList.add('show', 'offline');
        document.getElementById('networkMessage').textContent = 'You are offline';
    } else if (connection && connection.effectiveType === 'slow-2g') {
        networkAlert.classList.add('show');
        networkAlert.classList.remove('offline');
        document.getElementById('networkMessage').textContent = 'Poor network connection detected';
    } else {
        networkAlert.classList.remove('show', 'offline');
    }
}

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
window.addEventListener('resize', initCanvas);

initCanvas();
updateNetworkStatus();
setInterval(updateNetworkStatus, 5000);
