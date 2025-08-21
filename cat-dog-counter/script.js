// Variables globales
let model = null;
let webcamStream = null;
let isWebcamActive = false;
let detectionInterval;
let lastDetectionTime = 0;
const DETECTION_COOLDOWN = 2000; // 2 segundos entre notificaciones

// Elementos del DOM
const webcamBtn = document.getElementById('webcamBtn');
const stopWebcamBtn = document.getElementById('stopWebcamBtn');
const uploadInput = document.getElementById('uploadInput');
const webcamElement = document.getElementById('webcam');
const outputCanvas = document.getElementById('outputCanvas');
const canvasContext = outputCanvas.getContext('2d');
const catCountElement = document.getElementById('catCount');
const dogCountElement = document.getElementById('dogCount');
const totalCountElement = document.getElementById('totalCount');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceValue = document.getElementById('confidenceValue');
const uploadedImage = document.getElementById('uploadedImage');
const imagePreview = document.querySelector('.image-preview');
const statusElement = document.getElementById('status');
const cameraOverlay = document.querySelector('.camera-overlay');
const currentModelElement = document.getElementById('currentModel');

// Crear elemento de audio
const notificationSound = new Audio('noti.mp3');
notificationSound.load();

// Inicializar la aplicación
async function init() {
    showStatus('Cargando modelo COCO-SSD...');
    try {
        model = await cocoSsd.load();
        currentModelElement.textContent = 'COCO-SSD';
        showStatus('Modelo COCO-SSD cargado exitosamente!', 'success');
        setTimeout(hideStatus, 2000);
    } catch (error) {
        console.error('Error al cargar COCO-SSD:', error);
        showStatus('Error al cargar el modelo. Verifica la consola.', 'error');
    }
}

// Reproducir sonido de notificación
function playNotificationSound() {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
}

// Mostrar estado
function showStatus(message, type = 'info') {
    statusElement.style.display = 'block';
    statusElement.querySelector('p').textContent = message;
    statusElement.style.background = type === 'error' ? '#ffebee' : 
                                   type === 'success' ? '#e8f5e9' : '#fff9db';
}

// Ocultar estado
function hideStatus() {
    statusElement.style.display = 'none';
}

// Inicializar la cámara web
async function setupWebcam() {
    if (!navigator.mediaDevices?.getUserMedia) {
        showStatus('Tu navegador no soporta acceso a la cámara', 'error');
        return;
    }

    try {
        showStatus('Solicitando acceso a la cámara...');
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        webcamElement.srcObject = webcamStream;

        webcamElement.style.display = 'block';
        imagePreview.style.display = 'none';
        cameraOverlay.style.display = 'none';

        isWebcamActive = true;
        webcamBtn.disabled = true;
        stopWebcamBtn.disabled = false;

        webcamElement.onloadedmetadata = () => {
            outputCanvas.width = webcamElement.videoWidth;
            outputCanvas.height = webcamElement.videoHeight;
            hideStatus();
            detectFrame(); // Iniciar detección
        };
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        showStatus('Permiso denegado o error al acceder a la cámara.', 'error');
    }
}

// Detener la cámara web
function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    isWebcamActive = false;
    webcamBtn.disabled = false;
    stopWebcamBtn.disabled = true;
    webcamElement.style.display = 'none';
    cameraOverlay.style.display = 'flex';

    canvasContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    if (detectionInterval) cancelAnimationFrame(detectionInterval);
    resetCounters();
}

// Reiniciar contadores
function resetCounters() {
    catCountElement.textContent = '0';
    dogCountElement.textContent = '0';
    totalCountElement.textContent = '0';
    confidenceBar.style.width = '0%';
    confidenceValue.textContent = '0%';
}

// Detectar objetos en un frame (webcam)
async function detectFrame() {
    if (!isWebcamActive || !model) {
        detectionInterval = requestAnimationFrame(detectFrame);
        return;
    }

    canvasContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    canvasContext.drawImage(webcamElement, 0, 0, outputCanvas.width, outputCanvas.height);

    let catCount = 0;
    let dogCount = 0;
    let totalConfidence = 0;

    try {
        const predictions = await model.detect(webcamElement);
        const detections = predictions.filter(pred => 
            pred.class.toLowerCase().includes('cat') || pred.class.toLowerCase().includes('dog')
        );

        detections.forEach(pred => {
            const isDog = pred.class.toLowerCase().includes('dog');
            const [x, y, width, height] = pred.bbox;
            const confidence = pred.score;

            if (isDog) dogCount++;
            else catCount++;

            totalConfidence += confidence;

            // Dibujar bounding box
            canvasContext.strokeStyle = isDog ? '#FF5252' : '#4CAF50';
            canvasContext.lineWidth = 2;
            canvasContext.strokeRect(x, y, width, height);

            // Etiqueta
            const label = isDog ? 'Perro' : 'Gato';
            const text = `${label} ${Math.round(confidence * 100)}%`;
            const textWidth = canvasContext.measureText(text).width;
            canvasContext.fillStyle = isDog ? 'rgba(255, 82, 82, 0.8)' : 'rgba(76, 175, 80, 0.8)';
            canvasContext.fillRect(x, y - 20, textWidth + 10, 20);
            canvasContext.fillStyle = 'white';
            canvasContext.font = '14px Arial';
            canvasContext.fillText(text, x + 5, y - 5);
        });

        const avgConfidence = detections.length > 0 ? (totalConfidence / detections.length) * 100 : 0;
        updateCounters(catCount, dogCount, avgConfidence);

        // Notificación de detección
        if ((catCount > 0 || dogCount > 0) && (Date.now() - lastDetectionTime > DETECTION_COOLDOWN)) {
            playNotificationSound();
            lastDetectionTime = Date.now();
        }

    } catch (error) {
        console.error('Error en detección:', error);
    }

    detectionInterval = requestAnimationFrame(detectFrame);
}

// Actualizar contadores y UI
function updateCounters(catCount, dogCount, confidence) {
    // Animar cambios
    if (parseInt(catCountElement.textContent) !== catCount) {
        catCountElement.classList.add('highlight');
        setTimeout(() => catCountElement.classList.remove('highlight'), 1000);
    }
    if (parseInt(dogCountElement.textContent) !== dogCount) {
        dogCountElement.classList.add('highlight');
        setTimeout(() => dogCountElement.classList.remove('highlight'), 1000);
    }

    // Actualizar valores
    catCountElement.textContent = catCount;
    dogCountElement.textContent = dogCount;
    totalCountElement.textContent = catCount + dogCount;

    const confidencePercent = Math.round(confidence);
    confidenceBar.style.width = `${confidencePercent}%`;
    confidenceValue.textContent = `${confidencePercent}%`;

    // Color según confianza
    if (confidencePercent > 70) confidenceBar.style.background = '#4caf50';
    else if (confidencePercent > 40) confidenceBar.style.background = '#ff9800';
    else confidenceBar.style.background = '#f44336';
}

// Procesar imagen subida
async function processUploadedImage(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        uploadedImage.src = e.target.result;
        imagePreview.style.display = 'block';

        if (isWebcamActive) stopWebcam();

        uploadedImage.onload = async () => {
            outputCanvas.width = uploadedImage.width;
            outputCanvas.height = uploadedImage.height;
            canvasContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
            canvasContext.drawImage(uploadedImage, 0, 0, outputCanvas.width, outputCanvas.height);

            let catCount = 0;
            let dogCount = 0;
            let totalConfidence = 0;
            let detectionCount = 0;

            try {
                const predictions = await model.detect(uploadedImage);
                const detections = predictions.filter(p => 
                    p.class === 'cat' || p.class === 'dog'
                );

                detections.forEach(pred => {
                    const [x, y, width, height] = pred.bbox;
                    const isDog = pred.class === 'dog';
                    const color = isDog ? '#339af0' : '#ff6b6b';

                    // Dibujar caja
                    canvasContext.strokeStyle = color;
                    canvasContext.lineWidth = 3;
                    canvasContext.strokeRect(x, y, width, height);

                    // Etiqueta
                    const text = `${pred.class} (${Math.round(pred.score * 100)}%)`;
                    const textWidth = canvasContext.measureText(text).width;
                    canvasContext.fillStyle = color;
                    canvasContext.fillRect(x, y - 25, textWidth + 15, 25);
                    canvasContext.fillStyle = 'white';
                    canvasContext.font = 'bold 14px Arial';
                    canvasContext.fillText(text, x + 5, y - 8);

                    // Contar
                    if (isDog) dogCount++;
                    else catCount++;

                    totalConfidence += pred.score;
                    detectionCount++;
                });

                const avgConfidence = detectionCount > 0 ? (totalConfidence / detectionCount) * 100 : 0;
                updateCounters(catCount, dogCount, avgConfidence);

                if (catCount === 0 && dogCount === 0) {
                    showStatus('No se detectaron gatos ni perros en la imagen', 'warning');
                    setTimeout(hideStatus, 3000);
                } else {
                    hideStatus();
                }
            } catch (error) {
                console.error('Error al procesar imagen:', error);
                showStatus('Error al procesar la imagen', 'error');
            }
        };
    };
    reader.readAsDataURL(file);
}

// Event listeners
webcamBtn.addEventListener('click', setupWebcam);
stopWebcamBtn.addEventListener('click', stopWebcam);
uploadInput.addEventListener('change', (e) => {
    if (e.target.files[0]) processUploadedImage(e.target.files[0]);
});

// Inicializar al cargar
window.addEventListener('load', init);

// Manejo de errores
window.addEventListener('error', (e) => {
    console.error('Error no capturado:', e.error);
    showStatus('Ocurrió un error inesperado. Recarga la página.', 'error');
});