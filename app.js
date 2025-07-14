// App State
let isTracking = false;
let startTime = null;
let totalDistance = 0;
let currentSpeed = 0;
let routePoints = [];
let lastPosition = null;
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

// Draw Route on Canvas
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

    // Draw start point
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(routePoints[0].x, routePoints[0].y, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Draw current position
    if (routePoints.length > 0) {
        const lastPoint = routePoints[routePoints.length - 1];
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Simulate GPS tracking (for demo purposes)
function simulateGPSUpdate() {
    if (!isTracking) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Simulate movement
    const angle = (Date.now() / 1000) * 0.5;
    const radius = 50 + Math.sin(Date.now() / 2000) * 30;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const newPoint = { x, y, timestamp: Date.now() };
    routePoints.push(newPoint);

    // Calculate distance and speed
    if (lastPosition) {
        const distance = Math.sqrt(
            Math.pow(x - lastPosition.x, 2) + Math.pow(y - lastPosition.y, 2)
        );
        totalDistance += distance * 0.01; // Convert pixels to km (rough approximation)
        
        const timeDiff = (newPoint.timestamp - lastPosition.timestamp) / 1000; // seconds
        if (timeDiff > 0) {
            currentSpeed = (distance * 0.01 / timeDiff) * 3600; // km/h
            speedHistory.push(currentSpeed);
            if (speedHistory.length > 10) speedHistory.shift();
        }
    }

    lastPosition = newPoint;
    drawRoute();
    updateStats();
}

// Update Live Stats
function updateStats() {
    distanceEl.textContent = totalDistance.toFixed(2);
    speedEl.textContent = currentSpeed.toFixed(1);
    
    if (startTime) {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        durationEl.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Start Tracking
function startTracking() {
    isTracking = true;
    startTime = Date.now();
    totalDistance = 0;
    currentSpeed = 0;
    routePoints = [];
    lastPosition = null;
    speedHistory = [];
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    canvasOverlay.style.display = 'none';
    workoutSummary.classList.remove('show');
    
    // Start GPS simulation
    const gpsInterval = setInterval(() => {
        if (!isTracking) {
            clearInterval(gpsInterval);
            return;
        }
        simulateGPSUpdate();
    }, 1000);

    // Start timer
    timerInterval = setInterval(updateStats, 1000);
    
    showToast('Tracking started!');
}

// Stop Tracking
function stopTracking() {
    isTracking = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    canvasOverlay.style.display = 'block';
    canvasOverlay.textContent = 'Workout completed';
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    showWorkoutSummary();
    showToast('Data synced successfully!');
}

// Show Workout Summary
function showWorkoutSummary() {
    const avgSpeed = speedHistory.length > 0 
        ? speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length 
        : 0;
    const calories = Math.round(totalDistance * 60); // Rough calculation
    const duration = startTime ? Date.now() - startTime : 0;
    
    document.getElementById('summaryDistance').textContent = `${totalDistance.toFixed(2)} km`;
    document.getElementById('summaryAvgSpeed').textContent = `${avgSpeed.toFixed(1)} km/h`;
    document.getElementById('summaryCalories').textContent = calories.toString();
    
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    document.getElementById('summaryDuration').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    workoutSummary.classList.add('show');
}

// Show Toast Notification
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Network Status Monitoring
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

// Event Listeners
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
window.addEventListener('resize', initCanvas);

// Initialize App
initCanvas();
updateNetworkStatus();

// Check network status periodically
setInterval(updateNetworkStatus, 5000);