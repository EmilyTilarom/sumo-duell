// Alle Klänge entstehen im Browser, es gibt keine Audiodateien.
export function createAudio() {
  let context = null;
  const audio = { muted: false, unlock, play };

  function unlock() {
    context ??= new AudioContext();
    if (context.state === "suspended") context.resume();
  }

  function tone(frequency, endFrequency, duration, type, volume, delay = 0) {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function noise(duration, volume, filterFrequency) {
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  const SOUNDS = {
    tick: () => tone(520, 520, 0.09, "square", 0.05),
    go: () => {
      tone(180, 150, 0.9, "sine", 0.3);
      tone(362, 300, 0.7, "triangle", 0.12);
    },
    chargeFull: () => tone(620, 930, 0.14, "triangle", 0.13),
    rush: () => noise(0.25, 0.18, 900),
    dodge: () => noise(0.16, 0.12, 2600),
    dodged: () => tone(800, 260, 0.2, "sine", 0.1),
    bump: () => tone(130, 70, 0.1, "sine", 0.22),
    hit: () => {
      tone(150, 45, 0.25, "sine", 0.45);
      noise(0.12, 0.25, 1500);
    },
    punish: () => {
      tone(190, 40, 0.35, "sawtooth", 0.25);
      noise(0.18, 0.3, 1800);
    },
    blocked: () => tone(330, 150, 0.14, "square", 0.12),
    braceBroken: () => {
      tone(240, 50, 0.32, "sawtooth", 0.26);
      noise(0.22, 0.3, 2400);
    },
    fall: () => tone(640, 90, 0.75, "sine", 0.2),
    shrink: () => tone(95, 60, 0.9, "sawtooth", 0.2),
    roundEnd: () => [392, 523, 659].forEach((f, i) => tone(f, f, 0.2, "triangle", 0.14, i * 0.12)),
    matchEnd: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.32, "triangle", 0.16, i * 0.16)),
  };

  function play(type) {
    if (audio.muted || !context) return;
    SOUNDS[type]?.();
  }

  return audio;
}
