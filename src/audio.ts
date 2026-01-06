// Procedural audio system using Web Audio API

let audioContext: AudioContext | null = null;
let wilhelmAudio: HTMLAudioElement | null = null;
let audioInitialized = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Resume audio context on user interaction (required by browsers)
export function initAudio(): void {
  // Try to load Wilhelm scream from Internet Archive
  wilhelmAudio = new Audio();
  wilhelmAudio.src = 'https://ia800208.us.archive.org/2/items/WilhelmScreamSample/WilhelmScream.mp3';
  wilhelmAudio.volume = 0.7;
  wilhelmAudio.load();

  // Resume audio on any user interaction
  const resumeAudio = () => {
    if (audioInitialized) return;
    audioInitialized = true;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    console.log('Audio initialized, context state:', ctx.state);
  };

  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);
  document.addEventListener('mousedown', resumeAudio);
}

// Play a simple tone
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  attack: number = 0.01,
  decay: number = 0.1
): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
  gainNode.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + attack + decay);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// Play noise burst (for impacts, explosions)
function playNoise(
  duration: number,
  volume: number = 0.2,
  highpass: number = 0,
  lowpass: number = 22000
): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  const highpassFilter = ctx.createBiquadFilter();
  highpassFilter.type = 'highpass';
  highpassFilter.frequency.value = highpass;

  const lowpassFilter = ctx.createBiquadFilter();
  lowpassFilter.type = 'lowpass';
  lowpassFilter.frequency.value = lowpass;

  source.connect(highpassFilter);
  highpassFilter.connect(lowpassFilter);
  lowpassFilter.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start();
}

// === GAME SOUND EFFECTS ===

export function playSpawnSound(): void {
  // Whoosh + pop
  playTone(200, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(400, 0.1, 'sine', 0.15), 50);
}

export function playSwordHit(): void {
  // Metallic clang
  playTone(800, 0.08, 'square', 0.15);
  playNoise(0.05, 0.1, 2000, 8000);
}

export function playHeavyHit(): void {
  // Heavier impact for Mini Pekka / Gold Knight
  playTone(150, 0.15, 'sawtooth', 0.25);
  playNoise(0.1, 0.15, 500, 4000);
  setTimeout(() => playTone(100, 0.1, 'sine', 0.2), 30);
}

export function playArrowShoot(): void {
  // Twang + whoosh
  playTone(600, 0.05, 'triangle', 0.15);
  playTone(400, 0.08, 'sine', 0.1);
}

export function playMagicHit(): void {
  // Sparkly magic impact
  playTone(800, 0.1, 'sine', 0.15);
  playTone(1200, 0.08, 'sine', 0.1);
  playTone(600, 0.12, 'triangle', 0.1);
}

export function playTowerShoot(): void {
  // Cannon-like boom
  playTone(120, 0.2, 'sawtooth', 0.2);
  playNoise(0.08, 0.15, 100, 2000);
}

export function playUnitDeath(): void {
  // Sad descending tone
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

export function playDrowningScream(): void {
  // Try to play the actual Wilhelm scream first
  if (wilhelmAudio && wilhelmAudio.readyState >= 2) {
    wilhelmAudio.currentTime = 0;
    wilhelmAudio.play().catch(() => {
      // If playback fails, fall back to procedural
      playProceduralScream();
    });
    // Also play splash
    setTimeout(() => playNoise(0.3, 0.3, 200, 4000), 800);
    return;
  }

  // Fall back to procedural Wilhelm-style scream
  playProceduralScream();
}

function playProceduralScream(): void {
  // Wilhelm scream style - iconic dramatic scream!
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const duration = 1.1;

  // Create multiple oscillators for rich harmonic content (like a human voice)
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  // Fundamental frequency - the main scream
  const fundamentalFreqs = [1, 2, 3, 4]; // Harmonic series
  const fundamentalAmps = [1, 0.5, 0.25, 0.125];

  fundamentalFreqs.forEach((harmonic, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';

    // Wilhelm scream characteristic: starts high, dips, rises, then falls
    // Classic "aaaAAAAaah" shape
    const baseFreq = 180 * harmonic; // Base frequency around 180Hz (male voice)
    osc.frequency.setValueAtTime(baseFreq * 4, now);           // Start high "a"
    osc.frequency.linearRampToValueAtTime(baseFreq * 6, now + 0.15);  // Rise to "AA"
    osc.frequency.linearRampToValueAtTime(baseFreq * 5.5, now + 0.4); // Sustain
    osc.frequency.linearRampToValueAtTime(baseFreq * 3, now + 0.8);   // Fall "aah"
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + duration);

    // Amplitude envelope
    const amp = fundamentalAmps[i] * 0.15;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.05);        // Attack
    gain.gain.linearRampToValueAtTime(amp * 1.5, now + 0.15);  // Peak on "AA"
    gain.gain.linearRampToValueAtTime(amp, now + 0.5);         // Sustain
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    oscillators.push(osc);
    gains.push(gain);
  });

  // Add vibrato for realism
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  vibrato.frequency.value = 6; // Natural voice vibrato ~6Hz
  vibratoGain.gain.setValueAtTime(0, now);
  vibratoGain.gain.linearRampToValueAtTime(30, now + 0.3);
  vibratoGain.gain.linearRampToValueAtTime(50, now + duration);

  vibrato.connect(vibratoGain);
  oscillators.forEach(osc => {
    vibratoGain.connect(osc.frequency);
  });

  // Add some noise for breathiness
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.02, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 2000;
  noiseFilter.Q.value = 1;

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Start everything
  vibrato.start(now);
  noiseSource.start(now);
  oscillators.forEach(osc => osc.start(now));

  // Stop everything
  vibrato.stop(now + duration);
  noiseSource.stop(now + duration);
  oscillators.forEach(osc => osc.stop(now + duration));

  // Add splash and bubbles after the scream
  setTimeout(() => {
    playNoise(0.3, 0.3, 200, 4000);
  }, 800);

  // Bubble sounds
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const bubbleFreq = 200 + Math.random() * 300;
      playTone(bubbleFreq, 0.1, 'sine', 0.15);
    }, 900 + i * 100);
  }
}

export function playFireball(): void {
  // Explosive whoosh
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Rising then falling tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.4);

  // Crackle
  playNoise(0.3, 0.25, 200, 4000);
}

export function playFreeze(): void {
  // Icy crystalline sound
  playTone(2000, 0.3, 'sine', 0.15, 0.01, 0.05);
  playTone(2500, 0.25, 'sine', 0.1, 0.05, 0.05);
  playTone(1800, 0.35, 'triangle', 0.1, 0.1, 0.1);

  // Crackling ice
  setTimeout(() => playNoise(0.15, 0.1, 4000, 12000), 100);
}

export function playPoison(): void {
  // Bubbling toxic sound
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Multiple bubbles
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const freq = 150 + Math.random() * 200;
      playTone(freq, 0.1, 'sine', 0.15);
    }, i * 60);
  }

  // Hiss
  playNoise(0.4, 0.1, 3000, 8000);
}

export function playRage(): void {
  // Aggressive power-up sound
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);

  // Rumble
  playTone(80, 0.4, 'sine', 0.2);
}

export function playKnockback(): void {
  // Powerful thump
  playTone(80, 0.15, 'sine', 0.3);
  playTone(60, 0.2, 'triangle', 0.2);
  playNoise(0.1, 0.15, 100, 1000);
}

export function playMegaKnightJump(): void {
  // EARTH SHATTERING SLAM!
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Whoosh up
  const whoosh = ctx.createOscillator();
  const whooshGain = ctx.createGain();
  whoosh.type = 'sawtooth';
  whoosh.frequency.setValueAtTime(100, ctx.currentTime);
  whoosh.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
  whooshGain.gain.setValueAtTime(0.1, ctx.currentTime);
  whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  whoosh.connect(whooshGain);
  whooshGain.connect(ctx.destination);
  whoosh.start();
  whoosh.stop(ctx.currentTime + 0.2);

  // SLAM after 0.3s
  setTimeout(() => {
    // Deep bass impact
    playTone(40, 0.4, 'sine', 0.5);
    playTone(60, 0.3, 'triangle', 0.4);
    playTone(80, 0.2, 'sawtooth', 0.3);
    // Debris/shockwave
    playNoise(0.3, 0.4, 50, 2000);
  }, 300);
}

export function playTowerDestroyed(): void {
  // Big explosion
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Low rumble
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);

  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.8);

  // Debris
  playNoise(0.5, 0.3, 100, 3000);
  setTimeout(() => playNoise(0.3, 0.2, 200, 2000), 200);
}

export function playVictory(): void {
  // Triumphant fanfare
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.4, 'triangle', 0.2);
    }, i * 150);
  });
}

export function playDefeat(): void {
  // Sad trombone
  const notes = [400, 380, 360, 300];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.3, 'sawtooth', 0.15);
    }, i * 200);
  });
}

export function playTeslaSpawn(): void {
  // Electric car startup whine
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);

  // Add electric hum
  const hum = ctx.createOscillator();
  const humGain = ctx.createGain();
  hum.type = 'sawtooth';
  hum.frequency.value = 60;
  humGain.gain.setValueAtTime(0.05, ctx.currentTime);
  humGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  hum.connect(humGain);
  humGain.connect(ctx.destination);
  hum.start();
  hum.stop(ctx.currentTime + 0.3);
}

export function playTeslaHit(): void {
  // Impact crunch + electric zap
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Crunch impact
  playNoise(0.1, 0.3, 200, 3000);

  // Electric zap
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);

  // Thump
  playTone(80, 0.15, 'sine', 0.25);
}

export function playTeslaHonk(): void {
  // Electric car horn
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.value = 440;
  osc2.type = 'sine';
  osc2.frequency.value = 550;

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.3);
  osc2.stop(ctx.currentTime + 0.3);
}

export function playSurgeSpawn(): void {
  // Electric power-up sound
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Rising electric whine
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.5);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);

  // Electric crackle
  playNoise(0.2, 0.15, 2000, 8000);

  // "SURGE!" voice-like tone
  setTimeout(() => {
    playTone(400, 0.1, 'square', 0.2);
    playTone(500, 0.15, 'square', 0.15);
  }, 200);
}

export function playSurgeShot(): void {
  // Electric zap shot
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);

  // Add a little buzz
  playNoise(0.05, 0.1, 3000, 6000);
}

export function playSurgeUpgrade(): void {
  // Power-up upgrade sound!
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Ascending tones
  const notes = [400, 600, 800, 1000];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.15, 'square', 0.2);
    }, i * 80);
  });

  // Electric burst
  setTimeout(() => {
    playNoise(0.15, 0.2, 2000, 10000);
  }, 250);
}

export function playPekkaDrop(): void {
  // Cartoon drop/plop sound
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Descending "boing" sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.2);

  // Add a little "thud"
  setTimeout(() => {
    playTone(80, 0.1, 'sine', 0.15);
  }, 100);
}

// Actual voice using Web Speech API: "Did somebody call for SURGE?"
export function playSurgeVoice(): void {
  // Use Web Speech API for actual voice
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance('Did somebody call for SURGE?');
    utterance.rate = 1.1; // Slightly faster
    utterance.pitch = 0.8; // Lower pitch for robotic feel
    utterance.volume = 1.0;

    // Try to find a robotic/male voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.toLowerCase().includes('male') ||
      v.name.toLowerCase().includes('daniel') ||
      v.name.toLowerCase().includes('alex') ||
      v.name.toLowerCase().includes('google')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
  }

  // Also play electric sound effect
  setTimeout(() => {
    playTone(600, 0.1, 'square', 0.15);
    playNoise(0.08, 0.12, 3000, 8000);
  }, 100);
}

// Lily sounds
export function playLilyShot(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Sharp thorn/spike sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);

  // Add a prickly noise
  playNoise(0.05, 0.08, 2000, 5000);
}

export function playLilyDash(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  // Whoosh/vanish sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);

  filter.type = 'highpass';
  filter.frequency.value = 300;

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.25);

  // Add a shimmer
  playNoise(0.1, 0.15, 4000, 10000);
}

// Lily voice using Web Speech API
export function playLilyVoice(): void {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance('Thorn in your side!');
    utterance.rate = 1.2;
    utterance.pitch = 1.4; // Higher pitch for feminine voice
    utterance.volume = 1.0;

    // Try to find a female voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
  }

  // Play a mysterious sound effect
  setTimeout(() => {
    playTone(500, 0.08, 'triangle', 0.12);
    playTone(700, 0.08, 'triangle', 0.1);
  }, 50);
}
