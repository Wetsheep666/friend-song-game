import { mkdirSync, writeFileSync } from 'node:fs';

// Original, deterministic synthesized placeholder audio. No external samples.
const rate = 22050, beat = .5, bar = 2, bars = 8;
const chords = [[130.81,164.81,196],[110,130.81,164.81],[87.31,110,130.81],[98,123.47,146.83]];
const melody = [523.25,659.25,587.33,392,440,523.25,659.25,587.33,349.23,440,523.25,440,392,493.88,587.33,392];
const envelope = (t,d) => Math.min(1,t/.018)*Math.max(0,1-t/d)**1.4;
function synth(t, part) {
  const chord = chords[Math.floor(t/bar)%4]; let out = 0;
  if (part === 'chords' || part === 'song') { const p = t % bar; out += chord.reduce((s,f) => s + Math.sin(2*Math.PI*f*t) + .13*Math.sin(4*Math.PI*f*t), 0)*.065*envelope(p,bar); }
  if (part === 'melody' || part === 'song') { const p = t % beat, n = Math.floor(t/beat), f = melody[n%melody.length]; out += (Math.sin(2*Math.PI*f*t)+.2*Math.sin(6*Math.PI*f*t))*.14*envelope(p,beat*.85); }
  if (part === 'drums' || part === 'song') { const p = t % beat; out += Math.sin(2*Math.PI*(65*p-16*p*p))*.17*Math.exp(-p*22); const q = t % .25; const noise = (Math.sin(t*17832.32)*43758.5453)%1; out += noise*.055*Math.exp(-q*90); }
  return out;
}
function wav(part, seconds) {
  const samples = Math.floor(rate*seconds), b = Buffer.alloc(44 + samples*2);
  b.write('RIFF'); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(samples*2,40);
  for (let i=0;i<samples;i++) { const t=i/rate, fade=part==='song'?Math.min(1,t/1.5,(seconds-t)/2):1; b.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,synth(t,part)*fade))*32767),44+i*2); }
  return b;
}
mkdirSync('public/audio',{recursive:true});
for (const p of ['chords','melody','drums']) writeFileSync(`public/audio/${p}.wav`,wav(p,bar*bars));
writeFileSync('public/audio/demo-song.wav',wav('song',32));
console.log('Generated 3 original 16-second loop stems and a 32-second demo song.');
