const song = 'ksgk';
const voices = ['rin', 'hanayo', 'maki', 'honoka', 'kotori', 'umi', 'nico', 'nozomi', 'eri'];
const sources = {};
const gains = {};
let instrumental;
let volumeControl;

let context;

let dataBuffers;
let instrumentalData;

let startTime;
let pausedTime;
let numActive = 0;

const shiftedNums = '!@#$%^&*(';

document.addEventListener('keypress', e => {
  if (shiftedNums.includes(e.key)) {
    const j = shiftedNums.indexOf(e.key);
    for (let i = 0; i < voices.length; i++) {
      const voiceEl = document.getElementById(voices[i]);
      if (i == j) {
        voiceEl.classList.add('active');
      } else {
        voiceEl.classList.remove('active');
      }
    }
    numActive = 1;
  }
});

document.addEventListener('keydown', e => {
  if (isFinite(e.key) && e.key > 0 && e.key < 10) {
    const voiceEl = document.getElementById(voices[e.key - 1]);
    if (!voiceEl.classList.contains('active')) {
      numActive++;
    }
    voiceEl.classList.add('active');
  }
});

document.addEventListener('keyup', e => {
  if (isFinite(e.key) && e.key > 0 && e.key < 10) {
    const voiceEl = document.getElementById(voices[e.key - 1]);
    if (voiceEl.classList.contains('active')) {
      numActive--;
    }
    voiceEl.classList.remove('active');
  }
});

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

document.getElementById('volume').addEventListener('input', e => {
  if (!volumeControl) return;
  volumeControl.gain.value = parseFloat(e.target.value);
});

document.getElementById('time').addEventListener('input', e => {
  const buttonText = document.getElementById('start').innerHTML;
  if (buttonText == 'Play') {
    pausedTime = parseFloat(e.target.value);
  } else {
    seek(e.target.value);
  }
});

document.getElementById('start').addEventListener('click', async e => {
  const button = document.getElementById('start');
  if (button.innerHTML == 'Pause' && context) {
    stop();
    button.innerHTML = 'Play';
    pausedTime = context.currentTime - startTime;
    return;
  } else if (button.innerHTML == 'Play' && context) {
    seek(pausedTime);
    pausedTime = undefined;
    button.innerHTML = 'Pause';
    return;
  } else if (button.innerHTML == 'Loading...') {
    return;
  }
  button.innerHTML = 'Loading...';
  button.disabled = true;
  context = new (window.AudioContext || window.webkitAudioContext)();
  const currentTime = context.currentTime;
  const audioBuffers = await Promise.all(dataBuffers.map(buf => context.decodeAudioData(buf)));

  volumeControl = context.createGain();
  volumeControl.gain.value = 0.5;
  volumeControl.connect(context.destination);

  instrumental = context.createBufferSource();
  instrumental.buffer = await context.decodeAudioData(instrumentalData);
  instrumental.connect(volumeControl);
  startTime = currentTime;
  instrumental.start(startTime);

  document.getElementById('time').setAttribute('max', instrumental.buffer.duration);

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

  button.innerHTML = 'Pause';
  button.disabled = false;
  document.getElementById('time').disabled = false;
  update();
});

function seek(offset) {
  if (!context || !instrumental) return;
  const currentTime = context.currentTime;
  instrumental.stop();
  const newInstrumental = context.createBufferSource();
  newInstrumental.buffer = instrumental.buffer;
  instrumental = newInstrumental;
  instrumental.connect(volumeControl);
  startTime = currentTime - offset;
  instrumental.start(currentTime, offset);

  voices.forEach(voice => {
    sources[voice].stop();
    const source = context.createBufferSource();
    source.buffer = sources[voice].buffer;
    source.connect(gains[voice]);
    sources[voice] = source;
    source.start(currentTime, offset);
  });
}

function stop() {
  instrumental.stop();

  voices.forEach(voice => {
    sources[voice].stop();
  });
}

let lastFrameTime;

function update() {
  window.requestAnimationFrame(update);

  let time = performance.now();
  const dt = (lastFrameTime ? time - lastFrameTime : 0.05) / 1000;
  lastFrameTime = time;
  const curTime = pausedTime ?? (startTime != undefined && context ? context.currentTime - startTime : 0);
  document.getElementById('timelabel').innerHTML = new Date(curTime * 1000).toISOString().substring(14, 22);
  document.getElementById('time').value = curTime;

  if (instrumental && instrumental.buffer && instrumental.buffer.duration < curTime) {
    seek(0);
  }

  for (const voice of voices) {
    const active = document.getElementById(voice).classList.contains('active');

    const maxGain = 1.8 / (numActive / 5 + 1);
    const gain = gains[voice];
    if (!gain) return;
    if (!active || gain.gain.value > maxGain) {
      gain.gain.value = Math.max(0, gain.gain.value - 3 * dt);
    } else {
      gain.gain.value = Math.min(1, gain.gain.value + 3 * dt);
    }
  }
}

 (async () => {
   dataBuffers = await Promise.all(voices.map(voice => fetch(`${song}/${voice}.ogg`).then(res => res.arrayBuffer())));
   instrumentalData = await fetch(`${song}/instrumental.ogg`).then(res => res.arrayBuffer());
   document.getElementById('start').disabled = false;
   document.getElementById('start').innerHTML = 'Start';
 })();