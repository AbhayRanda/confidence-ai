/**
 * Vanilla JS Application Logic for Confidence AI
 */

// --- STATE & CONFIG ---
const API_BASE_URL = 'http://127.0.0.1:8000';
let currentStream = null;
let isRecording = false;
let pollingInterval = null;

// --- DOM ELEMENTS ---
const elements = {
    // Nav
    navItems: document.querySelectorAll('.nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    mobileToggle: document.getElementById('mobile-toggle'),
    sidebar: document.getElementById('sidebar'),
    menuClose: document.getElementById('menu-close'),
    
    // Dashboard KPI
    dashEyeVal: document.getElementById('dash-eye-val'),
    dashEyeBar: document.getElementById('dash-eye-bar'),
    dashPostureVal: document.getElementById('dash-posture-val'),
    dashPostureBar: document.getElementById('dash-posture-bar'),
    dashSpeechVal: document.getElementById('dash-speech-val'),
    dashSpeechBar: document.getElementById('dash-speech-bar'),
    refreshBtn: document.getElementById('refresh-dashboard'),
    
    // Camera
    startRecBtn: document.getElementById('start-rec-btn'),
    webcam: document.getElementById('webcam'),
    aiOverlay: document.getElementById('ai-overlay'),
    cameraLoading: document.getElementById('camera-loading'),
    recIndicator: document.getElementById('rec-indicator'),
    
    // Live Metrics
    liveEyeVal: document.getElementById('live-eye-val'),
    liveEyeRing: document.getElementById('live-eye-ring'),
    livePostureVal: document.getElementById('live-posture-val'),
    livePostureRing: document.getElementById('live-posture-ring'),
    feedbackList: document.getElementById('feedback-list'),
    
    // Settings
    cameraSelect: document.getElementById('camera-select'),
    micSelect: document.getElementById('mic-select'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// --- CHART INSTANCES ---
let mainChartObj = null;
let breakdownChartObj = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupMobileMenu();
    setupCameraControls();
    loadDevices();
    fetchDashboardData();
});

// --- NAVIGATION ---
function setupNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active classes
            elements.navItems.forEach(nav => nav.classList.remove('active'));
            elements.viewSections.forEach(section => section.classList.remove('active'));
            
            // Add active to clicked target
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // Render specific charts if needed
            if(targetId === 'dashboard-view') fetchDashboardData();
            if(targetId === 'reports-view') fetchReportsData();
            
            // Auto close mobile menu
            elements.sidebar.classList.remove('open');
        });
    });
}

function setupMobileMenu() {
    elements.mobileToggle.addEventListener('click', () => {
        elements.sidebar.classList.add('open');
    });
    elements.menuClose.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
    });
}

// --- CAMERA & WEBRTC ---
async function loadDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        elements.cameraSelect.innerHTML = '';
        elements.micSelect.innerHTML = '';
        
        devices.forEach(device => {
            if (device.kind === 'videoinput') {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.text = device.label || \`Camera \${elements.cameraSelect.length + 1}\`;
                elements.cameraSelect.appendChild(opt);
            } else if (device.kind === 'audioinput') {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.text = device.label || \`Microphone \${elements.micSelect.length + 1}\`;
                elements.micSelect.appendChild(opt);
            }
        });
        
    } catch (error) {
        console.warn("Could not load devices", error);
        elements.cameraSelect.innerHTML = '<option>Permission Denied</option>';
        elements.micSelect.innerHTML = '<option>Permission Denied</option>';
    }
}

function setupCameraControls() {
    elements.startRecBtn.addEventListener('click', async () => {
        if (!isRecording) {
            // Start
            try {
                isRecording = true;
                elements.cameraLoading.classList.remove('hidden');
                
                const constraints = {
                    video: elements.cameraSelect.value ? { deviceId: { exact: elements.cameraSelect.value } } : true,
                    audio: false // Just mock visually for now so no echo
                };
                
                currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                elements.webcam.srcObject = currentStream;
                
                // UI Updates
                elements.cameraLoading.classList.add('hidden');
                elements.aiOverlay.classList.remove('hidden');
                elements.startRecBtn.innerHTML = '<i class="ph-fill ph-stop-circle"></i> Stop Analysis';
                elements.startRecBtn.classList.add('recording');
                elements.recIndicator.classList.add('recording');
                elements.recIndicator.querySelector('.label').textContent = 'ANALYZING';
                
                // Start mocking live backend telemetry
                startLiveAnalysisSimulation();
                
                showToast("Live analysis started", "success");
            } catch (err) {
                isRecording = false;
                elements.cameraLoading.classList.add('hidden');
                showToast("Failed to access camera", "error");
                console.error(err);
            }
        } else {
            // Stop
            isRecording = false;
            
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                elements.webcam.srcObject = null;
            }
            
            // UI Updates
            elements.aiOverlay.classList.add('hidden');
            elements.startRecBtn.innerHTML = '<i class="ph-fill ph-play-circle"></i> Start Analysis';
            elements.startRecBtn.classList.remove('recording');
            elements.recIndicator.classList.remove('recording');
            elements.recIndicator.querySelector('.label').textContent = 'READY';
            
            stopLiveAnalysisSimulation();
            showToast("Analysis complete", "success");
            fetchDashboardData(); // Refresh UI
        }
    });
}

function startLiveAnalysisSimulation() {
    elements.feedbackList.innerHTML = '';
    let tick = 0;
    
    pollingInterval = setInterval(() => {
        // Randomly fluctuate scores to mock live AI feeding data
        const eyeScore = Math.min(100, Math.max(30, 75 + Math.floor(Math.random() * 20 - 10)));
        const postScore = Math.min(100, Math.max(30, 85 + Math.floor(Math.random() * 10 - 5)));
        
        updateCircularProgress(elements.liveEyeRing, elements.liveEyeVal, eyeScore);
        updateCircularProgress(elements.livePostureRing, elements.livePostureVal, postScore);
        
        tick++;
        // Emit mock feedback
        if (tick % 4 === 0) {
            const feedbacks = [
                { msg: "Great eye contact! Keep it up.", type: "success" },
                { msg: "Shoulders drooping. Straighten up.", type: "warning" },
                { msg: "Voice tone is steady and confident.", type: "success" },
                { msg: "Look at the camera lens, not the screen.", type: "warning" }
            ];
            const randTip = feedbacks[Math.floor(Math.random() * feedbacks.length)];
            
            const li = document.createElement('li');
            li.className = \`feedback-item \${randTip.type}\`;
            li.textContent = randTip.msg;
            
            elements.feedbackList.prepend(li);
            if (elements.feedbackList.children.length > 5) {
                elements.feedbackList.lastChild.remove();
            }
        }
    }, 1500);
}

function stopLiveAnalysisSimulation() {
    clearInterval(pollingInterval);
    updateCircularProgress(elements.liveEyeRing, elements.liveEyeVal, 0);
    updateCircularProgress(elements.livePostureRing, elements.livePostureVal, 0);
    elements.feedbackList.innerHTML = '<li class="feedback-item empty-state">Ready for next session.</li>';
}

function updateCircularProgress(ringEl, valEl, percentage) {
    if(!ringEl || !valEl) return;
    const offset = 100 - percentage;
    ringEl.style.strokeDasharray = \`\${percentage}, 100\`;
    valEl.textContent = percentage;
}

// --- DATA FETCHING & RENDERING ---
elements.refreshBtn.addEventListener('click', fetchDashboardData);

function fetchDashboardData() {
    elements.refreshBtn.querySelector('i').classList.add('ph-spin');
    
    // Instead of failing if backend is down, we use Mock Data smoothly
    const mockData = [
        { created_at: new Date(Date.now() - 400000000).toISOString(), confidence_score: 55, eye_contact_percentage: 60, posture_percentage: 70, speech_score: 50 },
        { created_at: new Date(Date.now() - 300000000).toISOString(), confidence_score: 65, eye_contact_percentage: 70, posture_percentage: 75, speech_score: 60 },
        { created_at: new Date(Date.now() - 200000000).toISOString(), confidence_score: 78, eye_contact_percentage: 82, posture_percentage: 80, speech_score: 75 },
        { created_at: new Date(Date.now() - 100000000).toISOString(), confidence_score: 82, eye_contact_percentage: 85, posture_percentage: 88, speech_score: 80 },
        { created_at: new Date().toISOString(), confidence_score: 88, eye_contact_percentage: 92, posture_percentage: 86, speech_score: 85 },
    ];
    
    const userId = "temp_user";
    
    fetch(\`\${API_BASE_URL}/dashboard\`, { headers: { "X-User-ID": userId } })
        .then(res => {
            if(!res.ok) throw new Error("API not running");
            return res.json();
        })
        .then(data => {
            if(data.length) renderDashboard(data);
            else renderDashboard(mockData);
        })
        .catch(err => {
            console.warn("Backend not detected, using mock datastream for UI presentation.");
            renderDashboard(mockData);
        })
        .finally(() => {
            setTimeout(() => elements.refreshBtn.querySelector('i').classList.remove('ph-spin'), 500);
        });
}

function renderDashboard(data) {
    // Sort chronological
    const sorted = [...data].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    const latest = sorted[sorted.length - 1];
    
    // Update KPI bars
    animateValue(elements.dashEyeVal, latest.eye_contact_percentage);
    elements.dashEyeBar.style.width = \`\${latest.eye_contact_percentage}%\`;
    
    animateValue(elements.dashPostureVal, latest.posture_percentage);
    elements.dashPostureBar.style.width = \`\${latest.posture_percentage}%\`;
    
    animateValue(elements.dashSpeechVal, latest.speech_score);
    elements.dashSpeechBar.style.width = \`\${latest.speech_score}%\`;
    
    // Render Chart
    renderMainChart(sorted);
}

function fetchReportsData() {
    // Mock for reports view
    const latest = { eye: 92, posture: 86, speech: 85, gestures: 75 };
    
    const container = document.getElementById('historical-metrics-list');
    container.innerHTML = \`
        <div class="metric-row">
            <div class="metric-name"><div class="m-icon" style="background: rgba(59,130,246,0.1); color: #3b82f6;"><i class="ph ph-eye"></i></div> Eye Contact</div>
            <div class="metric-score" style="color: #3b82f6;">\${latest.eye}%</div>
        </div>
        <div class="metric-row">
            <div class="metric-name"><div class="m-icon" style="background: rgba(139,92,246,0.1); color: #8b5cf6;"><i class="ph ph-person"></i></div> Posture</div>
            <div class="metric-score" style="color: #8b5cf6;">\${latest.posture}%</div>
        </div>
        <div class="metric-row">
            <div class="metric-name"><div class="m-icon" style="background: rgba(6,182,212,0.1); color: #06b6d4;"><i class="ph ph-microphone-stage"></i></div> Speech</div>
            <div class="metric-score" style="color: #06b6d4;">\${latest.speech}%</div>
        </div>
        <div class="metric-row">
            <div class="metric-name"><div class="m-icon" style="background: rgba(16,185,129,0.1); color: #10b981;"><i class="ph ph-hand-waving"></i></div> Gestures</div>
            <div class="metric-score" style="color: #10b981;">\${latest.gestures}%</div>
        </div>
    \`;
    
    renderBreakdownChart(latest);
}

// --- CHART.JS CONFIG ---
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Poppins', sans-serif";

function renderMainChart(data) {
    const ctx = document.getElementById('mainTrendChart').getContext('2d');
    
    if (mainChartObj) mainChartObj.destroy();
    
    const labels = data.map(d => new Date(d.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}));
    const scores = data.map(d => d.confidence_score);
    
    // Create gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    
    mainChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Overall Score',
                data: scores,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(15, 17, 26, 0.9)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                x: { grid: { display: false }, border: { display: false } }
            }
        }
    });
}

function renderBreakdownChart(metrics) {
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    if (breakdownChartObj) breakdownChartObj.destroy();
    
    breakdownChartObj = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Eye Contact', 'Posture', 'Speech', 'Gestures', 'Clarity'],
            datasets: [{
                label: 'Latest Score',
                data: [metrics.eye, metrics.posture, metrics.speech, metrics.gestures, 80],
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderColor: '#8b5cf6',
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#06b6d4',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#94a3b8', font: { size: 12 } },
                    ticks: { display: false, min: 0, max: 100 }
                }
            }
        }
    });
}

// --- UTILITIES ---
function showToast(message, type = "success") {
    const toast = document.createElement('div');
    toast.className = \`toast \${type}\`;
    
    const iconClass = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    
    toast.innerHTML = \`
        <i class="ph-fill \${iconClass}" style="font-size: 20px;"></i>
        <span>\${message}</span>
    \`;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function animateValue(obj, end, duration = 1000) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * end) + "%";
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
