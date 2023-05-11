const songs = [{
  name: 'Kitto Seishun ga Kikoeru',
  color: '#f6b2d8',
  folder: 'ksgk',
  voices: [
    { name: 'nico', color: '#D54E8D' },
    { name: 'nozomi', color: '#744791' },
    { name: 'eri', color: '#36B3DD' },
    { name: 'honoka', color: '#E2732D' },
    { name: 'kotori', color: '#8C9395' },
    { name: 'umi', color: '#1660A5' },
    { name: 'rin', color: '#F1C51F' },
    { name: 'hanayo', color: '#54AB48' },
    { name: 'maki', color: '#CC3554' },
  ],
  layout: [3, 3, 3],
  extension: 'ogg',
},
{
  name: 'Koko kara, koko kara',
  color: '#87CEEB',
  folder: 'kkkk',
  voices: [
    { name: 'hinata', color: '#C1E1C1' },
    { name: 'mari', color: '#FAC898' },
    { name: 'shirase', color: '#f49ac2' },
    { name: 'yuzuki', color: '#A7C7E7' },
  ],
  layout: [2, 2],
  extension: 'mp3',
}];

const SHIFTED_NUMS = '!@#$%^&*(';

class VocalSimulator {
  constructor(song) {
    this.song = song;
    this.voices = this.song.voices.map(voice => voice.name);
    this.sources = {};
    this.gains = {};
    this.numActive = 0;
    this.init();
  }

  async init() {
    await this.loadAudio();
    this.createButtons();
    this.initListeners();
  }

  async loadAudio() {
    this.dataBuffers = await Promise.all(this.voices.map(voice => fetch(`${this.song.folder}/${voice}.${this.song.extension}`).then(res => res.arrayBuffer())));
    this.instrumentalData = await fetch(`${this.song.folder}/instrumental.${this.song.extension}`).then(res => res.arrayBuffer());
    document.getElementById('start').disabled = false;
    document.getElementById('start').innerHTML = 'Start';
  }

  createButtons() {
    let output = '';
    let i = 0;
    for (const n of this.song.layout) {
      output += "<div class='row'>"
      for (let j = 0; j < n; j++) {
        const voice = this.song.voices[i];
        output += `<div id='${this.song.folder}-${voice.name}' style='background-color: ${voice.color};'><span>${voice.name}</span></div>`;
        i++;
      }
      output += "</div>";
    }

    document.getElementById('voices').innerHTML = output;
  }

  getButtonByVoice(voice) {
    return document.getElementById(`${this.song.folder}-${voice}`);
  }

  initListeners() {
    this.keyPressHandler = e => {
      if (SHIFTED_NUMS.includes(e.key)) {
        const j = SHIFTED_NUMS.indexOf(e.key);
        for (let i = 0; i < this.voices.length; i++) {
          const voiceEl = this.getButtonByVoice(this.voices[i]);
          if (i == j) {
            voiceEl.classList.add('active');
          } else {
            voiceEl.classList.remove('active');
          }
        }
        this.numActive = 1;
      }
    }

    this.keyDownHandler = e => {
      if (isFinite(e.key) && e.key > 0 && e.key < 10) {
        const voiceEl = this.getButtonByVoice(this.voices[e.key - 1]);
        if (!voiceEl.classList.contains('active')) {
          this.numActive++;
        }
        voiceEl.classList.add('active');
      }
    }

    this.keyUpHandler = e => {
    if (isFinite(e.key) && e.key > 0 && e.key < 10) {
        const voiceEl = this.getButtonByVoice(this.voices[e.key - 1]);
        if (voiceEl.classList.contains('active')) {
          this.numActive--;
        }
        voiceEl.classList.remove('active');
      }
    }

    this.clickHandler = e => {
      const target = e.target.id ? e.target : e.target.parentElement;

      if (!target || !this.voices.includes(target.id.split('-')[1])) return;

      target.classList.toggle('active');
      if (target.classList.contains('active')) {
        this.numActive++;
      } else {
        this.numActive--;
      }
    }

    this.volumeControlHandler = e => {
      if (!this.volumeControl) return;
      this.volumeControl.gain.value = parseFloat(e.target.value);
    }

    this.seekHandler = e => {
      const buttonText = document.getElementById('start').innerHTML;
      if (buttonText == 'Play') {
        this.pausedTime = parseFloat(e.target.value);
      } else {
        this.seek(e.target.value);
      }
    }

    this.startButtonHandler = async e => {
      const button = document.getElementById('start');
      if (button.innerHTML == 'Pause' && this.context) {
        this.stop();
        button.innerHTML = 'Play';
        this.pausedTime = this.context.currentTime - this.startTime;
        return;
      } else if (button.innerHTML == 'Play' && this.context) {
        this.seek(this.pausedTime);
        this.pausedTime = undefined;
        button.innerHTML = 'Pause';
        return;
      } else if (button.innerHTML == 'Loading...') {
        return;
      }
      button.innerHTML = 'Loading...';
      button.disabled = true;
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      const currentTime = this.context.currentTime;
      const audioBuffers = await Promise.all(this.dataBuffers.map(buf => this.context.decodeAudioData(buf)));

      this.volumeControl = this.context.createGain();
      this.volumeControl.gain.value = parseFloat(document.getElementById('volume').value);
      this.volumeControl.connect(this.context.destination);

      this.instrumental = this.context.createBufferSource();
      this.instrumental.buffer = await this.context.decodeAudioData(this.instrumentalData);
      this.instrumental.connect(this.volumeControl);
      this.startTime = currentTime;
      this.instrumental.start(this.startTime);

      document.getElementById('time').setAttribute('max', this.instrumental.buffer.duration);

      audioBuffers.forEach((buf, i) => {
        const voice = this.voices[i];
        const source = this.context.createBufferSource();
        source.buffer = buf;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.volumeControl);
        this.sources[voice] = source;
        this.gains[voice] = gain;
        source.start(this.startTime);
       });

      button.innerHTML = 'Pause';
      button.disabled = false;
      document.getElementById('time').disabled = false;
      this.update();
    }

    document.addEventListener('keypress', this.keyPressHandler);
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    document.addEventListener('click', this.clickHandler);
    document.getElementById('volume').addEventListener('input', this.volumeControlHandler);
    document.getElementById('time').addEventListener('input', this.seekHandler);
    document.getElementById('start').addEventListener('click', this.startButtonHandler);
  }

  removeListeners() {
    document.removeEventListener('keypress', this.keyPressHandler);
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    document.removeEventListener('click', this.clickHandler);
    document.getElementById('volume').removeEventListener('input', this.volumeControlHandler);
    document.getElementById('time').removeEventListener('input', this.seekHandler);
    document.getElementById('start').removeEventListener('click', this.startButtonHandler);
  }

  disableAll() {
    const start = document.getElementById('start');
    start.disabled = true;
    start.innerHTML = 'Loading...';
    
    const time = document.getElementById('time');
    time.disabled = true;
    document.getElementById('timelabel').innerHTML = '00:00.00';
  }

  destroy() {
    this.destroyed = true;
    this.removeListeners();
    this.disableAll();
    this.stop();
    // may need to destroy audio stuff
  }

  update = () => {
    if (this.destroyed) {
      return;
    }

    window.requestAnimationFrame(this.update);

    let time = performance.now();
    const dt = (this.lastFrameTime ? time - this.lastFrameTime : 0.05) / 1000;
    this.lastFrameTime = time;
    const curTime = this.pausedTime ?? (this.startTime != undefined && this.context ? this.context.currentTime - this.startTime : 0);
    document.getElementById('timelabel').innerHTML = new Date(curTime * 1000).toISOString().substring(14, 22);
    document.getElementById('time').value = curTime;

    if (this.instrumental && this.instrumental.buffer && this.instrumental.buffer.duration < curTime) {
      this.seek(0);
    }

    for (const voice of this.voices) {
      const active = this.getButtonByVoice(voice).classList.contains('active');

      const maxGain = 2 / (this.numActive / 3 + 2) + 0.25;
      const gain = this.gains[voice];
      if (!gain) return;
      if (!active || gain.gain.value > maxGain) {
        gain.gain.value = Math.max(0, gain.gain.value - 3 * dt);
      } else {
        gain.gain.value = Math.min(1, gain.gain.value + 3 * dt);
      }
    }
  }

  seek(offset) {
    if (!this.context || !this.instrumental) return;
    const currentTime = this.context.currentTime;
    this.instrumental.stop();
    const newInstrumental = this.context.createBufferSource();
    newInstrumental.buffer = this.instrumental.buffer;
    this.instrumental = newInstrumental;
    this.instrumental.connect(this.volumeControl);
    this.startTime = currentTime - offset;
    this.instrumental.start(currentTime, offset);

    this.voices.forEach(voice => {
      this.sources[voice].stop();
      const source = this.context.createBufferSource();
      source.buffer = this.sources[voice].buffer;
      source.connect(this.gains[voice]);
      this.sources[voice] = source;
      source.start(currentTime, offset);
    });
  }

  stop() {
    if (this.instrumental) {
      this.instrumental.stop();
    }

    this.voices.forEach(voice => {
      if (this.sources[voice]) {
        this.sources[voice].stop();
      }
    });
  }
}

let vs;

function selectSong(i) {
  if (vs) {
    vs.destroy();
  }
  vs = new VocalSimulator(songs[i]);
  vs.loadAudio();
}

let output = '';
for (const song of songs) {
  output += `<div style="background-color: ${song.color};">${song.name}</div>`;
}
const menu = document.getElementById('menu');
menu.innerHTML = output;

const helpDialog = document.getElementById('helpDialog');
const helpButton = document.getElementById('helpButton');
let showingHelp = false;

document.addEventListener('click', e => {
  if (e.target.parentElement === menu) {
    selectSong(Array.prototype.indexOf.call(menu.children, e.target));
  } else if (e.target === helpButton && !showingHelp) {
    helpDialog.show();
    showingHelp = true;
    return;
  }

  if (e.target !== helpDialog) {
    helpDialog.close();
    showingHelp = false;
  }
})

selectSong(0);