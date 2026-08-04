/* Salida de avisos: voz, sonido y cartel en pantalla.
   Se carga en las dos ventanas, pero cada una activa sólo lo suyo:
   la principal habla, el overlay enseña. */

let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* Tonos sintetizados: nada de ficheros de audio que instalar.
   Suben para avisar, bajan para cerrar. */
const TONES = {
  alert: [[880, 0], [1320, 0.09]],
  warn: [[660, 0]],
  end: [[660, 0], [440, 0.1]],
};

export function playSound(kind, volume = 0.5) {
  const tone = TONES[kind] ?? TONES.warn;
  const ac = ctx();
  for (const [freq, delay] of tone) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t0 = ac.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  }
}

let queued = 0;
let voices = [];
function loadVoices() { voices = window.speechSynthesis?.getVoices() ?? []; return voices; }
loadVoices();
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;

export function listVoices() { return (voices.length ? voices : loadVoices()).map((v) => ({ name: v.name, lang: v.lang })); }

export function speak(text, opts = {}) {
  if (!text || !window.speechSynthesis) return;
  if (opts.queue) {
    // El chat se encola: cortar a mitad de frase lo hace ininteligible.
    // Pero con cola larga llegaría tarde, así que se descarta el exceso.
    if (window.speechSynthesis.pending && queued >= 3) return;
    queued++;
  } else {
    // Los avisos de combate sí cortan: uno tardío no sirve de nada.
    window.speechSynthesis.cancel();
    queued = 0;
  }
  const u = new SpeechSynthesisUtterance(text);
  const want = opts.voice && (voices.length ? voices : loadVoices()).find((v) => v.name === opts.voice);
  if (want) u.voice = want;
  else u.lang = opts.speech ?? 'es-ES';
  u.rate = opts.rate ?? 1;
  u.volume = opts.volume ?? 1;
  if (opts.queue) u.onend = u.onerror = () => { queued = Math.max(0, queued - 1); };
  window.speechSynthesis.speak(u);
}

/* Cartel en pantalla. Se apila hacia abajo y cada aviso se va solo. */
export function mountBanner(container) {
  const host = document.createElement('div');
  host.className = 'alerts';
  (container ?? document.body).appendChild(host);
  return function show(alert) {
    if (!alert.text) return;
    const el = document.createElement('div');
    el.className = 'alert';
    if (alert.color) el.style.borderColor = alert.color;
    el.textContent = alert.text;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, Math.max(800, alert.holdMs ?? 4000));
    while (host.children.length > 5) host.firstChild.remove();
  };
}
