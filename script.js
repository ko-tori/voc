const song = 'ksgk';
const voices = ['honoka', 'kotori', 'umi', 'rin', 'hanayo', 'maki', 'eri', 'nozomi', 'nico'];
const sources = {};
const gains = {};
let instrumental;
let volumeControl;

let context;

let dataBuffers;
let instrumentalData;

let startTime;
let numActive = 0;

document.addEventListener('click', e => {
  const target = e.target.id ? e.target : e.target.parentElement;

  if (!target || !voices.includes(target.id)) return;

  target.classList.toggle('active');
  if (target.classList.contains('active')) {
    numActive++;
  } else {
    numActive--;
  }
});

document.getElementById('volume').addEventListener('change', e => {
  if (!volumeControl) return;
  volumeControl.gain.value = parseFloat(e.target.value);
});

document.getElementById('start').addEventListener('click', async e => {
  e.target.innerHTML = 'Loading...';
  e.target.disabled = true;
  context = new (window.AudioContext || window.webkitAudioContext)();
  const currentTime = context.currentTime;
  const audioBuffers = await Promise.all(dataBuffers.map(buf => context.decodeAudioData(buf)));

  volumeControl = context.createGain();
  volumeControl.gain.value = 0.5;
  volumeControl.connect(context.destination);

  instrumental = context.createBufferSource();
  instrumental.buffer = await context.decodeAudioData(instrumentalData);
  instrumental.connect(volumeControl);
  startTime = currentTime + 0.5;
  instrumental.start(startTime);

  audioBuffers.forEach((buf, i) => {
    const voice = voices[i];
    const source = context.createBufferSource();
    source.buffer = buf;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(volumeControl);
    sources[voice] = source;
    gains[voice] = gain;
    source.start(startTime);
   });

  e.target.innerHTML = 'Playing';
});

function update() {
  document.getElementById('timer').innerHTML = (startTime && context) ? (context.currentTime - startTime).toFixed(2) : 0;

  for (const voice of voices) {
    const active = document.getElementById(voice).classList.contains('active');

    const maxGain = 1 / (numActive / 7 + 1);
    const gain = gains[voice];
    if (!gain) return;
    if (!active || gain.gain.value > maxGain) {
      gain.gain.value = Math.max(0, gain.gain.value - 0.1);
    } else {
      gain.gain.value = Math.min(1, gain.gain.value + 0.1);
    }
  }
}

setInterval(update, 50);

 (async () => {
   dataBuffers = await Promise.all(voices.map(voice => fetch(`${song}/${voice}.ogg`).then(res => res.arrayBuffer())));
   instrumentalData = await fetch(`${song}/instrumental.ogg`).then(res => res.arrayBuffer());
 })();