/**
 * Baby Dino Jump - Core Game Engine
 * Features: Interactive face-crop, physics, procedural parallax rendering,
 * particle systems, achievements, Web Audio synth chiptune music, and leaderboard.
 */

// --- GLOBAL GAME STATE & CONSTANTS ---
const GAME_STATE = {
  // Screens
  currentScreen: 'menu', // 'menu' or 'game'
  
  // Crop Editor State
  crop: {
    x: 540,      // Pre-set on baby's face in the 1024x494 image
    y: 320,
    r: 45,
    dragging: false,
    resizing: false,
    dragStart: { x: 0, y: 0 },
    cropStart: { x: 0, y: 0, r: 0 },
    handleIndex: -1 // 0: Top-Left, 1: Top-Right, 2: Bottom-Right, 3: Bottom-Left
  },
  
  // Player Physics & State
  player: {
    x: 100,
    y: 0,
    width: 65,
    height: 75,
    vy: 0,
    gravity: 0.7,
    jumpForce: -14,
    doubleJumpForce: -11,
    isGrounded: false,
    isDucking: false,
    canDoubleJump: true,
    score: 0,
    distance: 0,
    state: 'running', // 'running', 'jumping', 'ducking', 'dead'
    legState: 0,      // Running animation frame
    headRotation: 0,
    squashStretch: { x: 1, y: 1 }
  },

  // Game Settings & Progression
  speed: 5.5,
  baseSpeed: 5.5,
  maxSpeed: 15,
  speedMultiplier: 1.0,
  scoreMultiplier: 1,
  activeEnvironment: 0, // 0: Jungle, 1: Synthwave, 2: Space
  soundEnabled: true,
  musicEnabled: false,
  
  // Entities
  obstacles: [],
  particles: [],
  parallaxLayers: [],
  
  // Timers & Systems
  nextObstacleTimer: 0,
  frameCount: 0,
  isGameOver: false,
  highScores: [],
  achievements: {
    first_run: { id: 'first_run', title: 'Bebé Valiente', desc: 'Inicia tu primer juego.', unlocked: false, icon: '🐣' },
    double_jump: { id: 'double_jump', title: 'Gravedad Cero', desc: 'Realiza un doble salto.', unlocked: false, icon: '💫' },
    score_150: { id: 'score_150', title: 'Saltador Experto', desc: 'Supera los 150 puntos.', unlocked: false, icon: '🦘' },
    synthwave_stage: { id: 'synthwave_stage', title: 'Piloto Synthwave', desc: 'Llega a la fase Synthwave (500 pts).', unlocked: false, icon: '🌅' },
    space_stage: { id: 'space_stage', title: 'Viajero Cósmico', desc: 'Llega a la fase espacial (1000 pts).', unlocked: false, icon: '🚀' },
    bone_breaker: { id: 'bone_breaker', title: 'Hueso Duro', desc: 'Choca a más de 300 puntos.', unlocked: false, icon: '🦴' }
  }
};

// Physics Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const GROUND_Y = 290;

// Env Palettes & Settings
const ENVS = [
  {
    name: "Selva Prehistórica",
    skyGradient: ["#1a103c", "#3d1e6d", "#7c3f91"],
    groundColor: "#1d4a3b",
    gridColor: "rgba(0, 240, 255, 0.05)",
    obstacleColor: "#2ecc71"
  },
  {
    name: "Synthwave Grid",
    skyGradient: ["#05021a", "#1a0845", "#f706cf"],
    groundColor: "#080321",
    gridColor: "rgba(247, 6, 207, 0.35)",
    obstacleColor: "#ff007f"
  },
  {
    name: "Cosmic Space",
    skyGradient: ["#02000a", "#05021b", "#090933"],
    groundColor: "#050412",
    gridColor: "rgba(0, 240, 255, 0.15)",
    obstacleColor: "#bd00ff"
  }
];

// --- DOM ELEMENTS ---
let cropImg, cropCanvas, cropCtx;
let gameCanvas, gameCtx;
let previewCanvas, previewCtx;
let animationFrameId;

// Audio Context (Procedural sound generation)
let audioCtx = null;
let musicNode = null;
let musicInterval = null;

// --- IMAGE PERSISTENCE HELPERS ---

// Compresses and saves the custom uploaded image to localStorage
function saveCustomImage(base64Str) {
  const img = new Image();
  img.onload = () => {
    const maxDim = 800;
    let width = img.width;
    let height = img.height;
    
    // Scale down if exceeding maxDim to prevent QuotaExceededError in localStorage
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw onto canvas
    ctx.drawImage(img, 0, 0, width, height);
    
    try {
      // Export as compressed JPEG base64 (75% quality is very light)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      localStorage.setItem('dino_custom_image', compressedDataUrl);
      console.log('Imagen de dino guardada y comprimida exitosamente.');
    } catch (e) {
      console.error('Error al guardar la imagen en localStorage:', e);
    }
  };
  img.src = base64Str;
}

// Saves crop settings (x, y, r) to localStorage
function saveCropSettings() {
  const cropData = {
    x: GAME_STATE.crop.x,
    y: GAME_STATE.crop.y,
    r: GAME_STATE.crop.r
  };
  localStorage.setItem('dino_crop_settings', JSON.stringify(cropData));
}

// --- INITIALIZATION ---
window.addEventListener('load', () => {
  // Load DOM Elements
  cropImg = document.getElementById('crop-source-img');
  cropCanvas = document.getElementById('crop-canvas');
  cropCtx = cropCanvas.getContext('2d');
  
  gameCanvas = document.getElementById('game-canvas');
  gameCtx = gameCanvas.getContext('2d');
  
  previewCanvas = document.getElementById('preview-canvas');
  previewCtx = previewCanvas.getContext('2d');

  // Load High Scores & Achievements from localStorage
  loadLeaderboard();
  loadAchievements();

  // Load saved player name if any
  const savedPlayerName = localStorage.getItem('dino_player_name');
  if (savedPlayerName) {
    document.getElementById('player-name-menu').value = savedPlayerName;
    document.getElementById('player-name-input').value = savedPlayerName;
  }
  
  // Set up settings toggle event listeners
  document.getElementById('btn-sound').addEventListener('click', toggleSound);
  document.getElementById('btn-music').addEventListener('click', toggleMusic);
  
  // Play Button
  document.getElementById('btn-play-game').addEventListener('click', startGame);
  
  // Game Over Controls
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  document.getElementById('btn-menu').addEventListener('click', showMenu);

  // Clear Leaderboard Button
  document.getElementById('btn-clear-scores').addEventListener('click', () => {
    if (confirm("¿Estás seguro de que deseas borrar todos los récords locales?")) {
      GAME_STATE.highScores = [];
      saveLeaderboard();
      renderLeaderboard();
      playAudioTone(150, 'sawtooth', 0.3, 0.15); // buzzer chime
    }
  });

  // Custom Image Upload Handler
  document.getElementById('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawData = event.target.result;
        cropImg.src = rawData;
        
        // Compress and save image
        saveCustomImage(rawData);
      };
      reader.readAsDataURL(file);
    }
  });

  // Reset Default Image Handler
  document.getElementById('btn-reset-image').addEventListener('click', () => {
    cropImg.src = 'media__1780202545083.jpg';
    localStorage.removeItem('dino_custom_image');
    localStorage.removeItem('dino_crop_settings');
    // Set to default coordinates
    GAME_STATE.crop.x = 540;
    GAME_STATE.crop.y = 320;
    GAME_STATE.crop.r = 45;
    initCropEditor();
  });
  
  // Setup Mobile Controls
  setupMobileControls();

  // Setup Keyboard Controls
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Touch listener on gameCanvas for mobile tap-to-jump
  gameCanvas.addEventListener('touchstart', (e) => {
    if (GAME_STATE.currentScreen === 'game' && !GAME_STATE.isGameOver) {
      playerJump();
      e.preventDefault();
    }
  }, { passive: false });

  // Load saved custom image and crop settings from localStorage
  const savedCustomImage = localStorage.getItem('dino_custom_image');
  const savedCropSettings = localStorage.getItem('dino_crop_settings');
  
  if (savedCustomImage) {
    cropImg.src = savedCustomImage;
  }
  
  if (savedCropSettings) {
    try {
      const cropData = JSON.parse(savedCropSettings);
      GAME_STATE.crop.x = cropData.x;
      GAME_STATE.crop.y = cropData.y;
      GAME_STATE.crop.r = cropData.r;
    } catch(e) {
      console.error("Error al cargar configuración de recorte:", e);
    }
  }

  // Initialize Cropper when Image loads (or immediately if already cached)
  cropImg.addEventListener('load', () => {
    if (cropImg.src.indexOf('data:') === 0) {
      // Custom uploaded image - center and expand crop circle ONLY if not loaded from settings
      if (!savedCropSettings) {
        GAME_STATE.crop.x = 512;
        GAME_STATE.crop.y = 247;
        GAME_STATE.crop.r = 60;
      }
    } else {
      // Default backseat photo - focus on the baby's face ONLY if not loaded from settings
      if (!savedCropSettings) {
        GAME_STATE.crop.x = 540;
        GAME_STATE.crop.y = 320;
        GAME_STATE.crop.r = 45;
      }
    }
    initCropEditor();
  });
  
  if (cropImg.complete) {
    cropImg.dispatchEvent(new Event('load'));
  }
  
  // Fallback in case the image fails to load properly
  cropImg.addEventListener('error', () => {
    console.error("No se pudo cargar la imagen del bebé. Usando marcador de posición.");
    initCropEditor();
  });

  // Detect iOS and display install tip if running in browser
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    const iosTip = document.getElementById('ios-install-tip');
    if (iosTip) iosTip.style.display = 'block';
  }
});

// --- AUDIO PROCEDURAL SYNTHESIZER ---

function initAudio() {
  if (audioCtx === null) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Toggle Sound VFX
function toggleSound() {
  GAME_STATE.soundEnabled = !GAME_STATE.soundEnabled;
  const btn = document.getElementById('btn-sound');
  if (GAME_STATE.soundEnabled) {
    btn.classList.add('active');
    btn.innerHTML = '🔊';
    playAudioTone(440, 'triangle', 0.1, 0.05); // quick beep confirmation
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '🔇';
  }
}

// Toggle Chiptune Background Music
function toggleMusic() {
  GAME_STATE.musicEnabled = !GAME_STATE.musicEnabled;
  const btn = document.getElementById('btn-music');
  if (GAME_STATE.musicEnabled) {
    btn.classList.add('active');
    btn.innerHTML = '🎵';
    initAudio();
    startMusicSynth();
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '📳';
    stopMusicSynth();
  }
}

// Play procedurally generated beep/synth sound
function playAudioTone(freq, type = 'sine', duration = 0.1, volume = 0.1, slideToFreq = 0) {
  if (!GAME_STATE.soundEnabled) return;
  initAudio();
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    if (slideToFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, audioCtx.currentTime + duration);
    }
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    // Smooth decay
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported: ", e);
  }
}

// Action sound triggers
function soundJump() {
  playAudioTone(180, 'triangle', 0.18, 0.15, 650);
}

function soundDoubleJump() {
  playAudioTone(380, 'triangle', 0.22, 0.15, 900);
}

function soundDuck() {
  playAudioTone(400, 'sawtooth', 0.15, 0.12, 100);
}

function soundMilestone() {
  // Arpeggio chord!
  setTimeout(() => playAudioTone(523.25, 'sine', 0.15, 0.2), 0);   // C5
  setTimeout(() => playAudioTone(659.25, 'sine', 0.15, 0.2), 80);  // E5
  setTimeout(() => playAudioTone(783.99, 'sine', 0.15, 0.2), 160); // G5
  setTimeout(() => playAudioTone(1046.5, 'sine', 0.3, 0.2), 240);  // C6
}

function soundCollision() {
  // Noise sweep crash
  playAudioTone(150, 'sawtooth', 0.4, 0.25, 40);
  playAudioTone(90, 'triangle', 0.5, 0.35, 10);
}

// Retro synth looping background music line
function startMusicSynth() {
  stopMusicSynth();
  if (!GAME_STATE.musicEnabled) return;
  
  // Retro 8-bit bass synth pattern
  // Notes in key: C minor (C, Eb, G, Bb)
  const notes = [
    130.81, 130.81, 155.56, 130.81,
    196.00, 196.00, 233.08, 196.00,
    146.83, 146.83, 174.61, 146.83,
    164.81, 164.81, 196.00, 164.81
  ];
  let noteIndex = 0;
  
  // Calculate tempo based on game speed
  const playNextNote = () => {
    if (!GAME_STATE.musicEnabled) return;
    
    // speed impacts bassline rhythm
    const tempo = Math.max(120, 280 - (GAME_STATE.speed * 12));
    
    const note = notes[noteIndex];
    playAudioTone(note, 'sawtooth', 0.18, 0.04);
    
    noteIndex = (noteIndex + 1) % notes.length;
    musicInterval = setTimeout(playNextNote, tempo);
  };
  
  playNextNote();
}

function stopMusicSynth() {
  if (musicInterval) {
    clearTimeout(musicInterval);
    musicInterval = null;
  }
}

// --- INTERACTIVE CROP EDITOR ---

function initCropEditor() {
  // Scale canvas size to layout aspect ratio
  resizeCropCanvas();
  window.addEventListener('resize', resizeCropCanvas);
  
  // Hook Up Dragging & Resizing Touch/Mouse Events
  cropCanvas.addEventListener('mousedown', handleCropMouseDown);
  window.addEventListener('mousemove', handleCropMouseMove);
  window.addEventListener('mouseup', handleCropMouseUp);
  
  cropCanvas.addEventListener('touchstart', handleCropTouchStart, { passive: false });
  cropCanvas.addEventListener('touchmove', handleCropTouchMove, { passive: false });
  cropCanvas.addEventListener('touchend', handleCropTouchEnd);

  // Redraw initially
  drawCropEditor();
  updatePreview();
}

function resizeCropCanvas() {
  const rect = cropCanvas.parentNode.getBoundingClientRect();
  cropCanvas.width = rect.width;
  cropCanvas.height = rect.height;
  drawCropEditor();
  updatePreview();
}

// Coordinates translation from screen canvas pixels to raw source image dimensions (1024x494)
function getSourceCoords(canvasX, canvasY) {
  const scaleX = 1024 / cropCanvas.width;
  const scaleY = 494 / cropCanvas.height;
  return {
    x: canvasX * scaleX,
    y: canvasY * scaleY
  };
}

function getCanvasCoords(sourceX, sourceY) {
  const scaleX = cropCanvas.width / 1024;
  const scaleY = cropCanvas.height / 494;
  return {
    x: sourceX * scaleX,
    y: sourceY * scaleY
  };
}

// Get resizing circle handles positions in Canvas space
function getHandles(cx, cy, cr) {
  return [
    { x: cx, y: cy - cr, cursor: 'ns-resize', index: 0 }, // Top
    { x: cx + cr, y: cy, cursor: 'ew-resize', index: 1 }, // Right
    { x: cx, y: cy + cr, cursor: 'ns-resize', index: 2 }, // Bottom
    { x: cx - cr, y: cy, cursor: 'ew-resize', index: 3 }  // Left
  ];
}

// Draw crop UI components overlay
function drawCropEditor() {
  if (!cropCtx) return;
  
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  
  // Render main base photo down-scaled
  cropCtx.drawImage(cropImg, 0, 0, cropCanvas.width, cropCanvas.height);
  
  // Overlay translucent dark veil on cropped-out regions
  cropCtx.fillStyle = 'rgba(8, 6, 15, 0.65)';
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  
  // Circular mask cutout of cropped region to show image in full color
  const cPos = getCanvasCoords(GAME_STATE.crop.x, GAME_STATE.crop.y);
  const cRadius = GAME_STATE.crop.r * (cropCanvas.width / 1024);
  
  cropCtx.save();
  cropCtx.beginPath();
  cropCtx.arc(cPos.x, cPos.y, cRadius, 0, Math.PI * 2);
  cropCtx.clip();
  cropCtx.drawImage(cropImg, 0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.restore();
  
  // Neon glowing circle border
  cropCtx.shadowBlur = 12;
  cropCtx.shadowColor = '#00f0ff';
  cropCtx.strokeStyle = '#00f0ff';
  cropCtx.lineWidth = 3;
  cropCtx.beginPath();
  cropCtx.arc(cPos.x, cPos.y, cRadius, 0, Math.PI * 2);
  cropCtx.stroke();
  cropCtx.shadowBlur = 0; // reset
  
  // Draw resizing handles
  const handles = getHandles(cPos.x, cPos.y, cRadius);
  handles.forEach(h => {
    cropCtx.fillStyle = '#ffffff';
    cropCtx.strokeStyle = '#ff007f';
    cropCtx.lineWidth = 2.5;
    cropCtx.beginPath();
    cropCtx.arc(h.x, h.y, 8, 0, Math.PI * 2);
    cropCtx.fill();
    cropCtx.stroke();
  });
}

// Dynamic Dinosaur Preview Render
function updatePreview() {
  if (!previewCtx) return;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // 1. Draw small cute pixel-style dinosaur body
  const bodyX = 50;
  const bodyY = 62;
  
  previewCtx.save();
  previewCtx.shadowColor = 'rgba(0, 240, 255, 0.5)';
  previewCtx.shadowBlur = 8;
  
  // Dino Body (Cute light-green lizard body)
  previewCtx.fillStyle = '#39e38c';
  
  // Tail
  previewCtx.beginPath();
  previewCtx.moveTo(bodyX - 25, bodyY - 15);
  previewCtx.quadraticCurveTo(bodyX - 45, bodyY - 30, bodyX - 45, bodyY - 20);
  previewCtx.quadraticCurveTo(bodyX - 45, bodyY, bodyX - 10, bodyY + 10);
  previewCtx.fill();
  
  // Main torso oval
  previewCtx.beginPath();
  previewCtx.arc(bodyX, bodyY, 20, 0, Math.PI * 2);
  previewCtx.fill();
  
  // Neck connection upward
  previewCtx.beginPath();
  previewCtx.moveTo(bodyX + 5, bodyY - 15);
  previewCtx.lineTo(bodyX + 22, bodyY - 28);
  previewCtx.lineTo(bodyX + 10, bodyY - 12);
  previewCtx.closePath();
  previewCtx.fill();
  
  // Pixelated spine plates (Cyan spikes)
  previewCtx.fillStyle = '#00f0ff';
  const drawSpike = (x, y) => {
    previewCtx.beginPath();
    previewCtx.moveTo(x, y);
    previewCtx.lineTo(x - 6, y - 8);
    previewCtx.lineTo(x - 10, y + 2);
    previewCtx.fill();
  };
  drawSpike(bodyX - 20, bodyY - 10);
  drawSpike(bodyX - 10, bodyY - 18);
  drawSpike(bodyX, bodyY - 22);
  
  // Two tiny feet (running state simulation)
  previewCtx.fillStyle = '#22bc71';
  previewCtx.fillRect(bodyX - 12, bodyY + 16, 8, 12);
  previewCtx.fillRect(bodyX + 4, bodyY + 16, 8, 12);
  
  // Tiny dinosaur claw hands
  previewCtx.fillStyle = '#39e38c';
  previewCtx.fillRect(bodyX + 12, bodyY - 5, 8, 6);
  
  previewCtx.restore();

  // 2. Crop Face from source image and draw on top as the dinosaur head
  previewCtx.save();
  previewCtx.beginPath();
  previewCtx.arc(bodyX + 15, bodyY - 30, 22, 0, Math.PI * 2);
  previewCtx.clip();
  
  // Draw the exact subregion from the loaded photo inside the clip
  const sX = GAME_STATE.crop.x - GAME_STATE.crop.r;
  const sY = GAME_STATE.crop.y - GAME_STATE.crop.r;
  const sD = GAME_STATE.crop.r * 2;
  
  previewCtx.drawImage(
    cropImg,
    sX, sY, sD, sD,               // Source crop box
    bodyX + 15 - 22, bodyY - 30 - 22, 44, 44  // Destination scale
  );
  previewCtx.restore();
  
  // Draw cute tiny Dino Hood frame or pixelated headband
  previewCtx.strokeStyle = '#00f0ff';
  previewCtx.lineWidth = 1.5;
  previewCtx.beginPath();
  previewCtx.arc(bodyX + 15, bodyY - 30, 22, 0, Math.PI * 2);
  previewCtx.stroke();
  
  // Tiny cute dino hat eye horn
  previewCtx.fillStyle = '#ff007f';
  previewCtx.beginPath();
  previewCtx.moveTo(bodyX + 15 - 5, bodyY - 30 - 22);
  previewCtx.lineTo(bodyX + 15, bodyY - 30 - 29);
  previewCtx.lineTo(bodyX + 15 + 5, bodyY - 30 - 22);
  previewCtx.fill();
}

// Mouse events handlers for cropping circle adjustment
function handleCropMouseDown(e) {
  const rect = cropCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const sourcePt = getSourceCoords(mouseX, mouseY);
  const currentCanvasRadius = GAME_STATE.crop.r * (cropCanvas.width / 1024);
  const canvasCenter = getCanvasCoords(GAME_STATE.crop.x, GAME_STATE.crop.y);
  
  // 1. Check if clicked a resize handle (increased hit detection radius to 22px for mobile touch)
  const handles = getHandles(canvasCenter.x, canvasCenter.y, currentCanvasRadius);
  for (let i = 0; i < handles.length; i++) {
    const dist = Math.hypot(mouseX - handles[i].x, mouseY - handles[i].y);
    if (dist <= 22) {
      GAME_STATE.crop.resizing = true;
      GAME_STATE.crop.handleIndex = i;
      GAME_STATE.crop.cropStart = { ...GAME_STATE.crop };
      GAME_STATE.crop.dragStart = { x: mouseX, y: mouseY };
      return;
    }
  }
  
  // 2. Check if clicked inside the crop circle to drag
  const distToCenter = Math.hypot(mouseX - canvasCenter.x, mouseY - canvasCenter.y);
  if (distToCenter <= currentCanvasRadius) {
    GAME_STATE.crop.dragging = true;
    GAME_STATE.crop.cropStart = { ...GAME_STATE.crop };
    GAME_STATE.crop.dragStart = { x: sourcePt.x, y: sourcePt.y };
  }
}

function handleCropMouseMove(e) {
  const rect = cropCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Set appropriate cursor style depending on hover location
  if (!GAME_STATE.crop.dragging && !GAME_STATE.crop.resizing) {
    const currentCanvasRadius = GAME_STATE.crop.r * (cropCanvas.width / 1024);
    const canvasCenter = getCanvasCoords(GAME_STATE.crop.x, GAME_STATE.crop.y);
    
    let isHoveringHandle = false;
    const handles = getHandles(canvasCenter.x, canvasCenter.y, currentCanvasRadius);
    for (let i = 0; i < handles.length; i++) {
      if (Math.hypot(mouseX - handles[i].x, mouseY - handles[i].y) <= 22) {
        cropCanvas.style.cursor = handles[i].cursor;
        isHoveringHandle = true;
        break;
      }
    }
    
    if (!isHoveringHandle) {
      if (Math.hypot(mouseX - canvasCenter.x, mouseY - canvasCenter.y) <= currentCanvasRadius) {
        cropCanvas.style.cursor = 'move';
      } else {
        cropCanvas.style.cursor = 'default';
      }
    }
  }

  // Handle Circle drag
  if (GAME_STATE.crop.dragging) {
    const sourcePt = getSourceCoords(mouseX, mouseY);
    const dx = sourcePt.x - GAME_STATE.crop.dragStart.x;
    const dy = sourcePt.y - GAME_STATE.crop.dragStart.y;
    
    // Bounds clamping
    GAME_STATE.crop.x = Math.max(GAME_STATE.crop.r, Math.min(1024 - GAME_STATE.crop.r, GAME_STATE.crop.cropStart.x + dx));
    GAME_STATE.crop.y = Math.max(GAME_STATE.crop.r, Math.min(494 - GAME_STATE.crop.r, GAME_STATE.crop.cropStart.y + dy));
    
    drawCropEditor();
    updatePreview();
  }
  
  // Handle Circle resize
  if (GAME_STATE.crop.resizing) {
    const dx = mouseX - GAME_STATE.crop.dragStart.x;
    const dy = mouseY - GAME_STATE.crop.dragStart.y;
    const sourceScale = 1024 / cropCanvas.width;
    
    let deltaRadius = 0;
    if (GAME_STATE.crop.handleIndex === 0) deltaRadius = -dy * sourceScale; // Top handle
    else if (GAME_STATE.crop.handleIndex === 1) deltaRadius = dx * sourceScale;  // Right handle
    else if (GAME_STATE.crop.handleIndex === 2) deltaRadius = dy * sourceScale;  // Bottom handle
    else if (GAME_STATE.crop.handleIndex === 3) deltaRadius = -dx * sourceScale; // Left handle
    
    GAME_STATE.crop.r = Math.max(20, Math.min(150, GAME_STATE.crop.cropStart.r + deltaRadius));
    
    // Fit adjustments
    GAME_STATE.crop.x = Math.max(GAME_STATE.crop.r, Math.min(1024 - GAME_STATE.crop.r, GAME_STATE.crop.x));
    GAME_STATE.crop.y = Math.max(GAME_STATE.crop.r, Math.min(494 - GAME_STATE.crop.r, GAME_STATE.crop.y));
    
    drawCropEditor();
    updatePreview();
  }
}

function handleCropMouseUp() {
  GAME_STATE.crop.dragging = false;
  GAME_STATE.crop.resizing = false;
  saveCropSettings();
}

// Touch controls mappings for mobile phones (Cropper Support)
function handleCropTouchStart(e) {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: t.clientX,
      clientY: t.clientY
    });
    cropCanvas.dispatchEvent(mouseEvent);
    
    // Only block page scrolling if we're actually dragging or resizing the circle
    if (GAME_STATE.crop.dragging || GAME_STATE.crop.resizing) {
      e.preventDefault();
    }
  }
}

function handleCropTouchMove(e) {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: t.clientX,
      clientY: t.clientY
    });
    window.dispatchEvent(mouseEvent);
    
    // Only block page scrolling if we're actually dragging or resizing the circle
    if (GAME_STATE.crop.dragging || GAME_STATE.crop.resizing) {
      e.preventDefault();
    }
  }
}

function handleCropTouchEnd(e) {
  const mouseEvent = new MouseEvent('mouseup', {});
  window.dispatchEvent(mouseEvent);
  saveCropSettings();
}

// --- PARALLAX BACKGROUND PROCEDURAL RENDERERS ---

class ParallaxLayer {
  constructor(speedFactor, drawFn) {
    this.speedFactor = speedFactor;
    this.drawFn = drawFn;
    this.x = 0;
  }
  
  update(gameSpeed) {
    this.x = (this.x - gameSpeed * this.speedFactor) % CANVAS_WIDTH;
  }
  
  draw(ctx) {
    ctx.save();
    // Translate and draw layered backgrounds twice to create visual infinite wrap
    ctx.translate(this.x, 0);
    this.drawFn(ctx);
    ctx.translate(CANVAS_WIDTH, 0);
    this.drawFn(ctx);
    ctx.restore();
  }
}

// Procedural environment layers definitions
function initParallaxLayers() {
  GAME_STATE.parallaxLayers = [];
  
  // Layer 1: Distant Vulcanoes / Mountains (Slow)
  GAME_STATE.parallaxLayers.push(new ParallaxLayer(0.08, (ctx) => {
    ctx.fillStyle = GAME_STATE.activeEnvironment === 0 
      ? '#241245' // Jungle Distant Vulcanoes
      : GAME_STATE.activeEnvironment === 1
        ? '#110633' // Synthwave Skyscrapers
        : '#060517'; // Cosmic Cosmic dust
        
    if (GAME_STATE.activeEnvironment === 0) {
      // Draw 3 big prehistoric vulcanos
      drawVulcano(ctx, 120, 290, 160, 120);
      drawVulcano(ctx, 450, 290, 220, 150);
      drawVulcano(ctx, 700, 290, 140, 90);
    } else if (GAME_STATE.activeEnvironment === 1) {
      // Draw glowing Synthwave skyscrapers silhouettes
      ctx.fillStyle = '#0f052d';
      ctx.fillRect(40, 100, 60, 190);
      ctx.fillRect(160, 140, 80, 150);
      ctx.fillRect(280, 80, 70, 210);
      ctx.fillRect(450, 120, 90, 170);
      ctx.fillRect(600, 90, 50, 200);
      ctx.fillRect(700, 150, 60, 140);
      
      // Neon windows dots
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      for (let y = 120; y < 270; y += 25) {
        ctx.fillRect(60, y, 6, 6);
        ctx.fillRect(80, y, 6, 6);
        ctx.fillRect(300, y - 30, 6, 6);
        ctx.fillRect(320, y - 30, 6, 6);
        ctx.fillRect(480, y + 10, 6, 6);
      }
    } else {
      // Space - Glowing nebulas (Radial Gradients)
      const grad1 = ctx.createRadialGradient(200, 120, 10, 200, 120, 150);
      grad1.addColorStop(0, 'rgba(189, 0, 255, 0.15)');
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(200, 120, 150, 0, Math.PI * 2);
      ctx.fill();
      
      const grad2 = ctx.createRadialGradient(600, 160, 20, 600, 160, 180);
      grad2.addColorStop(0, 'rgba(255, 0, 127, 0.15)');
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(600, 160, 180, 0, Math.PI * 2);
      ctx.fill();
    }
  }));

  // Layer 2: Midground Foliage / Wireframe Sun / Planets (Medium)
  GAME_STATE.parallaxLayers.push(new ParallaxLayer(0.25, (ctx) => {
    if (GAME_STATE.activeEnvironment === 0) {
      // Jungle Palms & Prehistoric ferns silhouettes
      ctx.fillStyle = '#172740';
      drawPalmTree(ctx, 80, 290, 85);
      drawPalmTree(ctx, 350, 290, 100);
      drawPalmTree(ctx, 620, 290, 90);
    } else if (GAME_STATE.activeEnvironment === 1) {
      // Synthwave Sun (Only drawn once in the wrapped background - we handle in loop)
      // Drew sunset lines procedurally
    } else {
      // Space: Beautiful Rotating Pixel Planets
      drawPlanet(ctx, 150, 80, 28, '#00f0ff', '#bd00ff');
      drawPlanet(ctx, 550, 140, 20, '#ff007f', '#ffee00');
    }
  }));

  // Layer 3: Foreground Ground Details / Shrubbery / Retro Lamps (Fast)
  GAME_STATE.parallaxLayers.push(new ParallaxLayer(0.6, (ctx) => {
    if (GAME_STATE.activeEnvironment === 0) {
      // Prehistoric jungle small shrubs & glowing neon mushrooms
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      drawMushroom(ctx, 180, 290, 16, '#00f0ff');
      drawMushroom(ctx, 490, 290, 12, '#ff007f');
      drawMushroom(ctx, 720, 290, 15, '#ffee00');
    } else if (GAME_STATE.activeEnvironment === 1) {
      // Synthwave glowing grid street poles
      ctx.fillStyle = 'rgba(255, 0, 127, 0.6)';
      for (let x = 100; x < CANVAS_WIDTH; x += 300) {
        ctx.fillRect(x, 220, 4, 70);
        // glowing light bulb
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f0ff';
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(x + 2, 220, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 0, 127, 0.6)';
      }
    } else {
      // Space Layer 3: Cosmic Rocks floating in foreground
      ctx.fillStyle = '#1c1b33';
      ctx.beginPath();
      ctx.moveTo(100, 200); ctx.lineTo(120, 190); ctx.lineTo(135, 205); ctx.lineTo(115, 215);
      ctx.closePath(); ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(400, 120); ctx.lineTo(415, 110); ctx.lineTo(430, 125); ctx.lineTo(410, 130);
      ctx.closePath(); ctx.fill();
    }
  }));
}

// Procedural visual components drawers helpers
function drawVulcano(ctx, x, baseY, w, h) {
  ctx.beginPath();
  ctx.moveTo(x - w/2, baseY);
  ctx.lineTo(x - w/8, baseY - h); // Crater edge
  ctx.lineTo(x + w/8, baseY - h);
  ctx.lineTo(x + w/2, baseY);
  ctx.closePath();
  ctx.fill();
  
  // Lava glow top
  ctx.fillStyle = '#ff007f';
  ctx.beginPath();
  ctx.moveTo(x - w/8, baseY - h);
  ctx.lineTo(x + w/8, baseY - h);
  ctx.lineTo(x + w/12, baseY - h + 15);
  ctx.lineTo(x - w/12, baseY - h + 15);
  ctx.closePath();
  ctx.fill();
}

function drawPalmTree(ctx, x, baseY, h) {
  // Curved Trunk
  ctx.lineWidth = 6;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x - 10, baseY - h/2, x - 5, baseY - h);
  ctx.stroke();
  
  // Palm Leaves
  ctx.save();
  ctx.translate(x - 5, baseY - h);
  ctx.lineWidth = 3;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15, -15, 30, -5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMushroom(ctx, x, baseY, h, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  
  // Stem
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 3, baseY - h, 6, h);
  
  // Cap
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, baseY - h, 10, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function drawPlanet(ctx, x, y, r, color1, color2) {
  ctx.save();
  // Planet Core
  const grad = ctx.createRadialGradient(x - r/3, y - r/3, r/5, x, y, r);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Ring for the planet
  ctx.strokeStyle = color1;
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 6);
  ctx.scale(2, 0.4);
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  
  ctx.restore();
}

// --- PARTICLE SYSTEM ---

class Particle {
  constructor(x, y, vx, vy, color, size, life, type = 'confetti') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.type = type; // 'confetti', 'dust', 'sparkle'
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    
    if (this.type === 'confetti') {
      this.vy += 0.2; // Gravity impacts confetti
      this.vx *= 0.98; // Air drag
    } else if (this.type === 'dust') {
      this.vx *= 0.95;
      this.size *= 0.96; // Shrink
    }
    
    this.life--;
  }
  
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    
    if (this.type === 'sparkle') {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = this.color;
      // Draw cross star particle
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - this.size);
      ctx.lineTo(this.x + this.size/2, this.y);
      ctx.lineTo(this.x, this.y + this.size);
      ctx.lineTo(this.x - this.size/2, this.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Particle triggers
function spawnLandingDust(x, y) {
  for (let i = 0; i < 8; i++) {
    const vx = (Math.random() - 0.5) * 3;
    const vy = -Math.random() * 1.5;
    const size = Math.random() * 4 + 2;
    GAME_STATE.particles.push(new Particle(x, y, vx, vy, 'rgba(255, 255, 255, 0.4)', size, 25, 'dust'));
  }
}

function spawnDoubleJumpSparkles(x, y) {
  const colors = ['#00f0ff', '#bd00ff', '#ff007f'];
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 1;
    const size = Math.random() * 6 + 4;
    const col = colors[Math.floor(Math.random() * colors.length)];
    GAME_STATE.particles.push(new Particle(x, y, vx, vy, col, size, 30, 'sparkle'));
  }
}

function spawnGameOverExplosion(x, y) {
  const colors = ['#ff007f', '#00f0ff', '#bd00ff', '#ffee00', '#ffffff'];
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 2;
    const size = Math.random() * 6 + 3;
    const col = colors[Math.floor(Math.random() * colors.length)];
    GAME_STATE.particles.push(new Particle(x, y, vx, vy, col, size, 50, 'confetti'));
  }
}

// --- GAME OBSTACLES ---

class Obstacle {
  constructor(x, type, sizeType) {
    this.x = x;
    this.type = type; // 'cactus_small', 'cactus_giant', 'cactus_triple', 'pterodactyl'
    this.sizeType = sizeType; // 0, 1, 2 (variations)
    this.width = 0;
    this.height = 0;
    this.y = 0;
    this.duckHitboxHeight = 0;
    
    // Set Dimensions based on type
    if (type === 'cactus_small') {
      this.width = 28 + Math.random() * 10;
      this.height = 42 + Math.random() * 12;
      this.y = GROUND_Y - this.height;
    } else if (type === 'cactus_giant') {
      this.width = 38 + Math.random() * 12;
      this.height = 68 + Math.random() * 15;
      this.y = GROUND_Y - this.height;
    } else if (type === 'cactus_triple') {
      this.width = 65 + Math.random() * 15;
      this.height = 48 + Math.random() * 10;
      this.y = GROUND_Y - this.height;
    } else if (type === 'pterodactyl') {
      this.width = 46;
      this.height = 30;
      // Spawns low (requires jump) or middle (requires duck)
      this.y = Math.random() > 0.5 ? GROUND_Y - 80 : GROUND_Y - 45;
      this.animFrame = 0;
    }
  }
  
  update(gameSpeed) {
    this.x -= gameSpeed;
    if (this.type === 'pterodactyl') {
      // Flapping wings animation
      if (GAME_STATE.frameCount % 10 === 0) {
        this.animFrame = 1 - this.animFrame;
      }
      this.x -= 1.8; // Flies slightly faster than scrolling speed!
    }
  }
  
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = ENVS[GAME_STATE.activeEnvironment].obstacleColor;
    
    // Draw neon glowing shadow borders
    ctx.shadowBlur = 8;
    ctx.shadowColor = ctx.fillStyle;
    
    if (this.type.includes('cactus')) {
      // Draw pixelated cactus silhouettes
      ctx.fillRect(this.x + this.width/2 - 5, this.y, 10, this.height); // Center stem
      ctx.fillRect(this.x + this.width/2 - 8, this.y, 16, 6); // Base branch connection
      
      // Side branches
      ctx.fillRect(this.x, this.y + this.height * 0.35, 6, this.height * 0.35); // Left arm
      ctx.fillRect(this.x, this.y + this.height * 0.35, this.width/2 - 5, 6);
      
      ctx.fillRect(this.x + this.width - 6, this.y + this.height * 0.25, 6, this.height * 0.4); // Right arm
      ctx.fillRect(this.x + this.width/2 + 5, this.y + this.height * 0.5, this.width/2 - 5, 6);
      
    } else if (this.type === 'pterodactyl') {
      // Draw procedural pixel flying dinosaur (wings flap)
      ctx.fillStyle = '#ffee00';
      ctx.shadowColor = '#ffee00';
      
      // Body & Head
      ctx.fillRect(this.x + 8, this.y + 10, 24, 8); // Torso
      ctx.fillRect(this.x + 28, this.y + 4, 12, 6);  // Beak/Head
      
      // flapping wings
      if (this.animFrame === 0) {
        // Wings UP
        ctx.fillRect(this.x + 14, this.y - 12, 6, 22);
        ctx.fillRect(this.x + 8, this.y - 12, 6, 6);
      } else {
        // Wings DOWN
        ctx.fillRect(this.x + 14, this.y + 10, 6, 22);
        ctx.fillRect(this.x + 20, this.y + 24, 6, 6);
      }
      
      // Tail
      ctx.fillRect(this.x, this.y + 10, 8, 4);
    }
    
    ctx.restore();
  }
  
  getHitbox() {
    // Return precise collision boxes
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 6
    };
  }
}

// --- CORE GAME CONTROLS & LOOPS ---

function startGame() {
  initAudio();
  
  // Sync name from menu input and save
  const menuName = document.getElementById('player-name-menu').value.trim().toUpperCase() || "BEBÉ DINO";
  document.getElementById('player-name-input').value = menuName;
  localStorage.setItem('dino_player_name', menuName);

  // Transition Menu UI to Game UI
  document.getElementById('menu-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  document.getElementById('kbd-hints').style.display = 'flex';
  
  // Update state values
  GAME_STATE.currentScreen = 'game';
  GAME_STATE.isGameOver = false;
  GAME_STATE.player.score = 0;
  GAME_STATE.player.distance = 0;
  GAME_STATE.player.y = 0;
  GAME_STATE.player.vy = 0;
  GAME_STATE.player.state = 'running';
  GAME_STATE.speed = GAME_STATE.baseSpeed;
  GAME_STATE.activeEnvironment = 0;
  GAME_STATE.obstacles = [];
  GAME_STATE.particles = [];
  GAME_STATE.frameCount = 0;
  GAME_STATE.nextObstacleTimer = 60; // Spawn first fast
  
  initParallaxLayers();
  
  // Triggers visual environment badge and theme confirmation
  updateHUD();
  
  // Track achievements
  unlockAchievement('first_run');
  
  // Start game loops & loops music
  if (GAME_STATE.musicEnabled) {
    startMusicSynth();
  }
  
  playAudioTone(330, 'triangle', 0.15, 0.15, 660); // Jump-like confirmation beep
  
  // Execute frame rendering loops
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(gameLoop);
}

function showMenu() {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('menu-screen').style.display = 'grid';
  document.getElementById('kbd-hints').style.display = 'none';
  
  GAME_STATE.currentScreen = 'menu';
  stopMusicSynth();
  
  // Force crop visual redraw to adjust sizing
  setTimeout(resizeCropCanvas, 100);
}

function restartGame() {
  document.getElementById('gameover-screen').style.display = 'none';
  startGame();
}

function handleKeyDown(e) {
  if (GAME_STATE.currentScreen !== 'game') return;
  
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    playerJump();
    e.preventDefault(); // Stop window browser scrolls
  }
  if (e.code === 'ArrowDown') {
    playerDuck(true);
    e.preventDefault();
  }
}

function handleKeyUp(e) {
  if (GAME_STATE.currentScreen !== 'game') return;
  
  if (e.code === 'ArrowDown') {
    playerDuck(false);
  }
}

function playerJump() {
  if (GAME_STATE.isGameOver) return;
  
  const p = GAME_STATE.player;
  if (p.isGrounded) {
    p.vy = p.jumpForce;
    p.isGrounded = false;
    p.state = 'jumping';
    p.canDoubleJump = true;
    p.squashStretch = { x: 0.8, y: 1.35 }; // Jump stretch
    soundJump();
    spawnLandingDust(p.x + p.width/2, GROUND_Y);
  } else if (p.canDoubleJump) {
    p.vy = p.doubleJumpForce;
    p.canDoubleJump = false;
    p.squashStretch = { x: 0.7, y: 1.4 }; // Double jump stretch
    soundDoubleJump();
    spawnDoubleJumpSparkles(p.x + p.width/2, p.y + p.height/2);
    unlockAchievement('double_jump');
  }
}

function playerDuck(isDucking) {
  if (GAME_STATE.isGameOver) return;
  
  const p = GAME_STATE.player;
  p.isDucking = isDucking;
  
  if (isDucking) {
    p.squashStretch = { x: 1.35, y: 0.65 }; // Duck squash
    if (p.isGrounded) {
      p.state = 'ducking';
      if (GAME_STATE.frameCount % 5 === 0) soundDuck();
    }
  } else {
    p.squashStretch = { x: 1, y: 1 }; // reset
    if (p.isGrounded) p.state = 'running';
  }
}

// Setup Touch Button bindings for mobile displays
function setupMobileControls() {
  const btnJump = document.getElementById('ctrl-jump');
  const btnDuck = document.getElementById('ctrl-duck');
  
  btnJump.addEventListener('touchstart', (e) => {
    playerJump();
    e.preventDefault();
  });
  
  btnDuck.addEventListener('touchstart', (e) => {
    playerDuck(true);
    e.preventDefault();
  });
  
  btnDuck.addEventListener('touchend', (e) => {
    playerDuck(false);
    e.preventDefault();
  });
}

// --- CORE PHYSICS LOOP ---

function gameLoop() {
  if (GAME_STATE.isGameOver) return;
  
  GAME_STATE.frameCount++;
  
  // 1. UPDATE ENVIRONMENT & PROGRESSION
  updateProgression();
  
  // 2. PHYSICS & COLLISIONS
  updatePlayerPhysics();
  updateObstacles();
  updateParticles();
  
  // 3. COLLISION CHECKS
  checkCollisions();
  
  // 4. DRAW EVERYTHING
  renderGameViewport();
  
  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateProgression() {
  GAME_STATE.player.distance += GAME_STATE.speed * 0.05;
  
  // Standard Dino-Style points count
  if (GAME_STATE.frameCount % 6 === 0) {
    GAME_STATE.player.score += GAME_STATE.scoreMultiplier;
    
    // Milestones beep (each 100 points)
    if (GAME_STATE.player.score > 0 && GAME_STATE.player.score % 100 === 0) {
      soundMilestone();
      // Brief visual flash on HUD can be felt via synth colors
    }
  }
  
  // Speed escalations
  if (GAME_STATE.frameCount % 400 === 0) {
    GAME_STATE.speed = Math.min(GAME_STATE.maxSpeed, GAME_STATE.speed + 0.5);
    GAME_STATE.speedMultiplier = (GAME_STATE.speed / GAME_STATE.baseSpeed).toFixed(1);
  }
  
  // Environment transition shifts based on scores
  const score = GAME_STATE.player.score;
  let newEnv = 0;
  if (score >= 1000) {
    newEnv = 2; // Space
    unlockAchievement('space_stage');
  } else if (score >= 500) {
    newEnv = 1; // Synthwave
    unlockAchievement('synthwave_stage');
  }
  
  if (score >= 150) {
    unlockAchievement('score_150');
  }
  
  if (newEnv !== GAME_STATE.activeEnvironment) {
    GAME_STATE.activeEnvironment = newEnv;
    initParallaxLayers(); // refresh background structures
    playAudioTone(220, 'sine', 0.4, 0.2, 880); // transitioning slide beep
  }
  
  updateHUD();
}

function updatePlayerPhysics() {
  const p = GAME_STATE.player;
  
  // Apply gravity
  p.vy += p.gravity;
  p.y += p.vy;
  
  // Collision with ground
  if (p.y >= 0) {
    p.y = 0;
    p.vy = 0;
    
    // Smooth landing physics squash
    if (!p.isGrounded) {
      p.isGrounded = true;
      p.state = p.isDucking ? 'ducking' : 'running';
      p.squashStretch = { x: 1.2, y: 0.8 }; // Landing landing impact squash
      spawnLandingDust(p.x + p.width/2, GROUND_Y);
      playAudioTone(100, 'sine', 0.05, 0.05); // low land tap
    }
  }
  
  // Recover squash/stretch shape smoothly
  p.squashStretch.x += (1 - p.squashStretch.x) * 0.15;
  p.squashStretch.y += (1 - p.squashStretch.y) * 0.15;
  
  // Animated head bobbing offset
  if (p.isGrounded) {
    p.legState = (GAME_STATE.frameCount % 8 >= 4) ? 1 : 0;
    p.headRotation = Math.sin(GAME_STATE.frameCount * 0.2) * 0.05;
  } else {
    p.headRotation = Math.min(0.2, Math.max(-0.2, p.vy * 0.02));
  }
}

function updateObstacles() {
  // Spawning logic
  GAME_STATE.nextObstacleTimer--;
  if (GAME_STATE.nextObstacleTimer <= 0) {
    // Generate type
    const types = ['cactus_small', 'cactus_giant', 'cactus_triple'];
    // Add birds once score gets high enough (e.g. over 120 pts)
    if (GAME_STATE.player.score >= 120) {
      types.push('pterodactyl');
    }
    
    const chosenType = types[Math.floor(Math.random() * types.length)];
    GAME_STATE.obstacles.push(new Obstacle(CANVAS_WIDTH + 50, chosenType, Math.floor(Math.random() * 3)));
    
    // Set dynamic delay before next obstacle (shorter spacing as speed increases)
    const baseDelay = 75 + Math.random() * 80;
    GAME_STATE.nextObstacleTimer = Math.max(35, baseDelay - (GAME_STATE.speed * 2));
  }
  
  // Update existing
  for (let i = GAME_STATE.obstacles.length - 1; i >= 0; i--) {
    const obs = GAME_STATE.obstacles[i];
    obs.update(GAME_STATE.speed);
    
    // Delete offscreen
    if (obs.x + obs.width < -100) {
      GAME_STATE.obstacles.splice(i, 1);
    }
  }
}

function updateParticles() {
  for (let i = GAME_STATE.particles.length - 1; i >= 0; i--) {
    const p = GAME_STATE.particles[i];
    p.update();
    if (p.life <= 0) {
      GAME_STATE.particles.splice(i, 1);
    }
  }
}

function checkCollisions() {
  const p = GAME_STATE.player;
  
  // Precise player hit boxes
  const pWidth = p.isDucking ? p.width * 1.2 : p.width;
  const pHeight = p.isDucking ? p.height * 0.55 : p.height;
  const pX = p.x;
  const pY = GROUND_Y - pHeight + p.y;
  
  const playerBox = {
    x: pX + 5,
    y: pY + 5,
    width: pWidth - 10,
    height: pHeight - 8
  };
  
  for (let i = 0; i < GAME_STATE.obstacles.length; i++) {
    const obs = GAME_STATE.obstacles[i];
    const obsBox = obs.getHitbox();
    
    // AABB intersection check
    if (playerBox.x < obsBox.x + obsBox.width &&
        playerBox.x + playerBox.width > obsBox.x &&
        playerBox.y < obsBox.y + obsBox.height &&
        playerBox.y + playerBox.height > obsBox.y) {
      triggerGameOver();
      break;
    }
  }
}

function triggerGameOver() {
  GAME_STATE.isGameOver = true;
  GAME_STATE.player.state = 'dead';
  stopMusicSynth();
  
  soundCollision();
  
  const p = GAME_STATE.player;
  const playerY = GROUND_Y - p.height + p.y;
  spawnGameOverExplosion(p.x + p.width/2, playerY + p.height/2);
  
  // Bone breaker achievement check
  if (GAME_STATE.player.score >= 300) {
    unlockAchievement('bone_breaker');
  }

  // Visual modal pop up
  setTimeout(() => {
    document.getElementById('go-score').textContent = GAME_STATE.player.score;
    document.getElementById('go-distance').textContent = Math.round(GAME_STATE.player.distance) + 'm';
    
    const isNewHighScore = checkAndRegisterHighScore(GAME_STATE.player.score);
    const registerForm = document.getElementById('leaderboard-register');
    
    if (isNewHighScore) {
      registerForm.style.display = 'block';
    } else {
      registerForm.style.display = 'none';
    }
    
    document.getElementById('gameover-screen').style.display = 'flex';
  }, 900);
}

// --- HUD RENDERER MANAGER ---

function updateHUD() {
  const scoreStr = String(GAME_STATE.player.score).padStart(5, '0');
  document.getElementById('hud-score').textContent = scoreStr;
  
  const maxScore = GAME_STATE.highScores.length > 0 ? GAME_STATE.highScores[0].score : 0;
  const hiScoreStr = String(Math.max(maxScore, GAME_STATE.player.score)).padStart(5, '0');
  document.getElementById('hud-highscore').textContent = 'HI ' + hiScoreStr;
  
  const envBadge = document.getElementById('hud-env-name');
  envBadge.textContent = ENVS[GAME_STATE.activeEnvironment].name;
  
  // Custom neon theme colors matching environment
  if (GAME_STATE.activeEnvironment === 0) {
    envBadge.style.color = '#2ecc71';
    envBadge.style.borderColor = 'rgba(46, 204, 113, 0.3)';
    document.getElementById('hud-score').style.color = '#00f0ff';
  } else if (GAME_STATE.activeEnvironment === 1) {
    envBadge.style.color = '#ff007f';
    envBadge.style.borderColor = 'rgba(255, 0, 127, 0.3)';
    document.getElementById('hud-score').style.color = '#ff007f';
  } else {
    envBadge.style.color = '#bd00ff';
    envBadge.style.borderColor = 'rgba(189, 0, 255, 0.3)';
    document.getElementById('hud-score').style.color = '#bd00ff';
  }
  
  document.getElementById('hud-multiplier').textContent = `x${GAME_STATE.speedMultiplier} Velocidad`;
}

// --- GAME VIEWPORT MAIN CANVAS DRAWING ---

function renderGameViewport() {
  if (!gameCtx) return;
  
  const env = ENVS[GAME_STATE.activeEnvironment];
  
  // 1. SKY BACKGROUND GRADIENT
  const skyGrad = gameCtx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGrad.addColorStop(0, env.skyGradient[0]);
  skyGrad.addColorStop(0.5, env.skyGradient[1]);
  skyGrad.addColorStop(1, env.skyGradient[2]);
  gameCtx.fillStyle = skyGrad;
  gameCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Extra: Synthwave Sunset giant Sun rendering
  if (GAME_STATE.activeEnvironment === 1) {
    drawSynthwaveSun(gameCtx, CANVAS_WIDTH / 2, 170, 75);
  }
  
  // 2. PARALLAX LAYERS DRAWING
  GAME_STATE.parallaxLayers.forEach(layer => {
    layer.update(GAME_STATE.speed);
    layer.draw(gameCtx);
  });
  
  // 3. RETRO GRID FLOOR / GROUND
  drawGroundFloor(gameCtx, env);
  
  // 4. OBSTACLES DRAWING
  GAME_STATE.obstacles.forEach(obs => {
    obs.draw(gameCtx);
  });
  
  // 5. PARTICLES DRAWING
  GAME_STATE.particles.forEach(p => {
    p.draw(gameCtx);
  });
  
  // 6. PLAYER RENDERING
  if (GAME_STATE.player.state !== 'dead') {
    drawPlayerDinosaur(gameCtx);
  }
}

function drawSynthwaveSun(ctx, cx, cy, r) {
  ctx.save();
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#ffee00');
  grad.addColorStop(0.5, '#f706cf');
  grad.addColorStop(1, '#ff007f');
  
  ctx.fillStyle = grad;
  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw horizontal slice bars lines (vaporwave theme)
  ctx.shadowBlur = 0;
  ctx.fillStyle = ENVS[1].skyGradient[2]; // match lower sky color
  let thickness = 2;
  for (let y = cy + 5; y < cy + r; y += 12) {
    ctx.fillRect(cx - r, y, r * 2, thickness);
    thickness += 1.5; // wider at bottom
  }
  ctx.restore();
}

function drawGroundFloor(ctx, env) {
  ctx.save();
  
  // Solid floor color
  ctx.fillStyle = env.groundColor;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  
  // Ground boundary line
  ctx.strokeStyle = env.obstacleColor;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 4;
  ctx.shadowColor = env.obstacleColor;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();
  
  // Draw glowing grid lines in Synthwave or Space
  ctx.shadowBlur = 0;
  ctx.strokeStyle = env.gridColor;
  ctx.lineWidth = 1.5;
  
  if (GAME_STATE.activeEnvironment === 1 || GAME_STATE.activeEnvironment === 2) {
    // 3D perspective receding grid lines
    const numLines = 14;
    const centerOffset = CANVAS_WIDTH / 2;
    for (let i = -numLines/2; i <= numLines/2; i++) {
      const startX = centerOffset + i * 20;
      const endX = centerOffset + i * 160;
      ctx.beginPath();
      ctx.moveTo(startX, GROUND_Y);
      ctx.lineTo(endX, CANVAS_HEIGHT);
      ctx.stroke();
    }
    
    // Horizontal perspective lines scrolling towards us
    const scrollOffset = (GAME_STATE.frameCount * (GAME_STATE.speed * 0.45)) % 60;
    for (let y = GROUND_Y; y < CANVAS_HEIGHT; y += 15) {
      // simulate speed warp spacing
      const adjustedY = y + scrollOffset * ((y - GROUND_Y + 1) / 30);
      if (adjustedY < CANVAS_HEIGHT) {
        ctx.beginPath();
        ctx.moveTo(0, adjustedY);
        ctx.lineTo(CANVAS_WIDTH, adjustedY);
        ctx.stroke();
      }
    }
  } else {
    // Prehistoric jungle - flat pixelated dirt lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    const lineX = -(GAME_STATE.frameCount * GAME_STATE.speed) % 80;
    for (let x = lineX; x < CANVAS_WIDTH + 80; x += 80) {
      ctx.moveTo(x, GROUND_Y + 12); ctx.lineTo(x + 20, GROUND_Y + 12);
      ctx.moveTo(x + 40, GROUND_Y + 28); ctx.lineTo(x + 55, GROUND_Y + 28);
    }
    ctx.stroke();
  }
  
  ctx.restore();
}

function drawPlayerDinosaur(ctx) {
  const p = GAME_STATE.player;
  const pHeight = p.isDucking ? p.height * 0.55 : p.height;
  const pY = GROUND_Y - pHeight + p.y;
  
  ctx.save();
  ctx.translate(p.x + p.width/2, pY + pHeight/2);
  
  // Apply visual physics squash & stretch scaling
  ctx.scale(p.squashStretch.x, p.squashStretch.y);
  
  // Neon shadow styling
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#39e38c';
  
  // Torso & Tail position offset in local space
  const localX = -p.width / 2;
  const localY = -pHeight / 2;
  
  // A. Cute Light Green Lizard Dinosaur Body
  ctx.fillStyle = '#39e38c';
  
  if (p.isDucking) {
    // Crawling Dino Torso
    ctx.beginPath();
    ctx.ellipse(0, 5, p.width * 0.45, pHeight * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Flat crawling Tail
    ctx.beginPath();
    ctx.moveTo(-p.width * 0.4, 8);
    ctx.quadraticCurveTo(-p.width * 0.8, -2, -p.width * 0.8, 10);
    ctx.quadraticCurveTo(-p.width * 0.7, 18, -p.width * 0.2, 12);
    ctx.closePath();
    ctx.fill();
    
    // Spikes flat
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-22, -2, 6, 6);
    ctx.fillRect(-10, -6, 6, 6);
    ctx.fillRect(2, -6, 6, 6);
  } else {
    // Upright Dino Torso
    ctx.beginPath();
    ctx.arc(-5, 8, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Upward tail curve
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.quadraticCurveTo(-38, -15, -38, -5);
    ctx.quadraticCurveTo(-36, 15, -5, 18);
    ctx.closePath();
    ctx.fill();
    
    // Neck connection
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(16, -18);
    ctx.lineTo(8, -5);
    ctx.closePath();
    ctx.fill();
    
    // Blue spine plates spikes
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    
    const drawBodySpike = (sx, sy) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 6, sy - 8);
      ctx.lineTo(sx - 10, sy + 1);
      ctx.closePath();
      ctx.fill();
    };
    drawBodySpike(-20, 2);
    drawBodySpike(-10, -5);
    drawBodySpike(0, -9);
  }
  
  // B. Tiny moving pixel legs (alternating feet position)
  ctx.fillStyle = '#22bc71';
  ctx.shadowColor = '#22bc71';
  
  if (p.isDucking) {
    // Sliding sliding mini legs
    ctx.fillRect(-15, 14, 6, 4);
    ctx.fillRect(8, 14, 6, 4);
  } else if (!p.isGrounded) {
    // Jumping folded feet
    ctx.fillRect(-12, 18, 6, 6);
    ctx.fillRect(2, 18, 6, 6);
  } else {
    // Running active steps feet logic
    if (p.legState === 0) {
      ctx.fillRect(-14, 18, 6, 10); // Leg 1 DOWN
      ctx.fillRect(4, 18, 6, 5);   // Leg 2 UP
    } else {
      ctx.fillRect(-14, 18, 6, 5);   // Leg 1 UP
      ctx.fillRect(4, 18, 6, 10);  // Leg 2 DOWN
    }
  }
  
  // Tiny claw hand
  ctx.fillStyle = '#39e38c';
  ctx.fillRect(10, 2, p.isDucking ? 6 : 8, 5);
  
  // C. THE CROPPED KID'S FACE HEAD (The core custom dynamic feature)
  ctx.save();
  
  // Position head local coordinates relative to torso
  const headX = p.isDucking ? 24 : 14;
  const headY = p.isDucking ? -10 : -22;
  const headRadius = 22;
  
  ctx.translate(headX, headY);
  ctx.rotate(p.headRotation);
  
  // Clip area shape circular mask
  ctx.beginPath();
  ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
  ctx.clip();
  
  // Draw the cropped boy face
  const sX = GAME_STATE.crop.x - GAME_STATE.crop.r;
  const sY = GAME_STATE.crop.y - GAME_STATE.crop.r;
  const sD = GAME_STATE.crop.r * 2;
  
  ctx.drawImage(
    cropImg,
    sX, sY, sD, sD,                 // Crop subregion
    -headRadius, -headRadius, headRadius * 2, headRadius * 2  // Scaled destination
  );
  
  ctx.restore();
  
  // Glowing cyan circular helmet rim
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#00f0ff';
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Neon Dino Hood decorative star spikes
  ctx.fillStyle = '#ff007f';
  ctx.shadowColor = '#ff007f';
  ctx.beginPath();
  ctx.moveTo(headX - 4, headY - headRadius);
  ctx.lineTo(headX, headY - headRadius - 8);
  ctx.lineTo(headX + 4, headY - headRadius);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// --- LOCAL STORAGE SCOREBOARD & LEADERBOARD SYSTEM ---

function loadLeaderboard() {
  const saved = localStorage.getItem('dino_highscores');
  if (saved) {
    GAME_STATE.highScores = JSON.parse(saved);
  } else {
    // Preset cute retro default scores
    GAME_STATE.highScores = [
      { name: "MAMÁ DINO", score: 850 },
      { name: "PAPÁ DINO", score: 620 },
      { name: "T-REX BEBÉ", score: 310 }
    ];
    saveLeaderboard();
  }
  renderLeaderboard();
}

function saveLeaderboard() {
  localStorage.setItem('dino_highscores', JSON.stringify(GAME_STATE.highScores));
}

function checkAndRegisterHighScore(score) {
  // Returns true if score beats any in top 5, preparing registration
  if (GAME_STATE.highScores.length < 5) return true;
  return score > GAME_STATE.highScores[GAME_STATE.highScores.length - 1].score;
}

// Submits high score name from form overlay
document.getElementById('player-name-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitHighScore();
  }
});

function submitHighScore() {
  const input = document.getElementById('player-name-input');
  let name = input.value.trim().toUpperCase();
  if (!name) name = "BEBÉ DINO";
  
  // Sync back to menu name input and save
  document.getElementById('player-name-menu').value = name;
  localStorage.setItem('dino_player_name', name);
  
  const newScore = {
    name: name,
    score: GAME_STATE.player.score
  };
  
  // Add, Sort and Slice Top 5
  GAME_STATE.highScores.push(newScore);
  GAME_STATE.highScores.sort((a, b) => b.score - a.score);
  GAME_STATE.highScores = GAME_STATE.highScores.slice(0, 5);
  
  saveLeaderboard();
  renderLeaderboard();
  
  // Hide form to prevent double-submit
  document.getElementById('leaderboard-register').style.display = 'none';
  playAudioTone(880, 'sine', 0.2, 0.15, 1200); // nice success chime
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  container.innerHTML = '';
  
  if (GAME_STATE.highScores.length === 0) {
    container.innerHTML = `<div class="no-scores">Aún no hay récords locales</div>`;
    return;
  }
  
  GAME_STATE.highScores.forEach((s, i) => {
    const ranks = ['first', 'second', 'third', 'normal'];
    const rankClass = i < 3 ? ranks[i] : ranks[3];
    
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <div class="score-player">
        <span class="score-rank ${rankClass}">${i + 1}</span>
        <span>${s.name}</span>
      </div>
      <span class="score-points">${s.score} pts</span>
    `;
    container.appendChild(row);
  });
}

// Override default restart menu action to also submit any pending score
document.getElementById('btn-restart').addEventListener('click', () => {
  const form = document.getElementById('leaderboard-register');
  if (form && form.style.display === 'block') {
    submitHighScore();
  }
});
document.getElementById('btn-menu').addEventListener('click', () => {
  const form = document.getElementById('leaderboard-register');
  if (form && form.style.display === 'block') {
    submitHighScore();
  }
});

// --- ACHIEVEMENTS SYSTEM ---

function loadAchievements() {
  const saved = localStorage.getItem('dino_achievements');
  if (saved) {
    const list = JSON.parse(saved);
    Object.keys(GAME_STATE.achievements).forEach(key => {
      if (list.includes(key)) {
        GAME_STATE.achievements[key].unlocked = true;
      }
    });
  }
  renderAchievements();
}

function saveAchievements() {
  const unlockedKeys = Object.keys(GAME_STATE.achievements).filter(k => GAME_STATE.achievements[k].unlocked);
  localStorage.setItem('dino_achievements', JSON.stringify(unlockedKeys));
}

function unlockAchievement(id) {
  const ach = GAME_STATE.achievements[id];
  if (ach && !ach.unlocked) {
    ach.unlocked = true;
    saveAchievements();
    renderAchievements();
    
    // Play majestic success double-beep chimes!
    setTimeout(() => playAudioTone(660, 'sine', 0.25, 0.2, 1320), 0);
    setTimeout(() => playAudioTone(880, 'sine', 0.3, 0.2, 1760), 100);
    
    // Show beautiful non-intrusive floating toast notification
    showAchievementToast(ach);
  }
}

function showAchievementToast(ach) {
  // Create beautiful dynamic absolute toast panel
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '-350px';
  toast.style.width = '300px';
  toast.style.background = 'rgba(20, 16, 35, 0.85)';
  toast.style.backdropFilter = 'blur(12px)';
  toast.style.border = '1px solid rgba(189, 0, 255, 0.4)';
  toast.style.borderRadius = '12px';
  toast.style.padding = '12px 18px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '15px';
  toast.style.color = '#fff';
  toast.style.zIndex = '9999';
  toast.style.transition = 'right 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  toast.style.boxShadow = '0 0 20px rgba(189, 0, 255, 0.3)';
  
  toast.innerHTML = `
    <div style="font-size: 1.8rem;">${ach.icon}</div>
    <div>
      <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--neon-pink); font-weight: 800; letter-spacing: 1px;">Logro Desbloqueado</div>
      <div style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: #ffee00;">${ach.title}</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Animate sliding IN
  setTimeout(() => {
    toast.style.right = '20px';
  }, 100);
  
  // Slide OUT and remove after 4 seconds
  setTimeout(() => {
    toast.style.right = '-350px';
    setTimeout(() => toast.remove(), 600);
  }, 4000);
}

function renderAchievements() {
  const container = document.getElementById('achievements-container');
  container.innerHTML = '';
  
  Object.keys(GAME_STATE.achievements).forEach(key => {
    const ach = GAME_STATE.achievements[key];
    const card = document.createElement('div');
    card.className = `achievement-card ${ach.unlocked ? 'unlocked' : ''}`;
    card.innerHTML = `
      <span class="achievement-icon">${ach.unlocked ? ach.icon : '🔒'}</span>
      <div class="achievement-info">
        <span class="achievement-title">${ach.title}</span>
        <span class="achievement-desc">${ach.desc}</span>
      </div>
    `;
    container.appendChild(card);
  });
}
