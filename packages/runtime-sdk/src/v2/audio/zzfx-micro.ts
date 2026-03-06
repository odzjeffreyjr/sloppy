/**
 * ZzFX Micro — Zuper Zmall Zound Zynth
 *
 * Minimal ZzFX engine (~900 bytes minified). Generates procedural sound
 * effects from parameter arrays using the Web Audio API.
 *
 * Original: https://github.com/KilledByAPixel/ZzFX (MIT License)
 * Author: Frank Force
 */

let zzfxContext: AudioContext | undefined;

function getContext(): AudioContext {
  if (!zzfxContext) {
    zzfxContext = new AudioContext();
  }
  return zzfxContext;
}

/**
 * Play a ZzFX sound from a parameter array.
 *
 * Usage: `zzfx(...SFX.jump)` or `zzfx(volume, randomness, frequency, ...)`
 */
export function zzfx(
  volume = 1,
  randomness = .05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = .1,
  shape = 0,
  shapeCurve = 1,
  slide = 0,
  deltaSlide = 0,
  pitchJump = 0,
  pitchJumpTime = 0,
  repeatTime = 0,
  noise = 0,
  modulation = 0,
  bitCrush = 0,
  delay = 0,
  sustainVolume = 1,
  decay = 0,
  tremolo = 0,
): AudioBufferSourceNode | undefined {
  const ctx = getContext();
  const sampleRate = ctx.sampleRate;
  const PI2 = Math.PI * 2;

  let startSlide = slide *= 500 * PI2 / sampleRate / sampleRate;
  let startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / sampleRate;

  let b: number[] = [];
  let t = 0;
  let tm = 0;
  let i = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;
  let f: number;
  let length: number;

  attack = attack * sampleRate + 9;
  decay = decay * sampleRate;
  sustain = sustain * sampleRate;
  release = release * sampleRate;
  delay = delay * sampleRate;

  length = attack + decay + sustain + release + delay | 0;

  for (; i < length; i++) {
    // Release envelope
    if (i < attack) {
      r = i / attack;
    } else if (i < attack + decay) {
      r = 1 + ((i - attack) / decay) * (sustainVolume - 1);
    } else if (i < attack + decay + sustain) {
      r = sustainVolume;
    } else {
      r = sustainVolume * (1 - (i - attack - decay - sustain) / release);
    }

    // Delay
    if (delay && i > length - delay) {
      r *= (length - i) / delay;
    }

    // Frequency slide
    frequency += slide += deltaSlide;

    // Pitch jump
    if (pitchJump && !(++c % (pitchJumpTime * 100 | 0))) {
      frequency += pitchJump;
      startFrequency += pitchJump;
    }

    // Repeat
    if (repeatTime && !(++j % (repeatTime * 100 | 0))) {
      frequency = startFrequency;
      slide = startSlide;
    }

    // Core oscillator
    t += frequency;
    tm += frequency * Math.abs(modulation);

    // Shape
    f = t;
    if (shape === 1) f = f % PI2 > PI2 / 2 ? 1 : -1;
    else if (shape === 2) f = Math.sin(f * f);
    else if (shape === 3) {
      f = ((f % PI2) / PI2 * 2 - 1);
      f = (f > 0 ? 1 : -1) * Math.pow(Math.abs(f), shapeCurve);
    } else if (shape === 4) f = Math.sin(f) * Math.sin(f * .5);
    else f = Math.sin(f);

    // Apply
    s = f * (noise ? Math.random() * noise : 1);
    s *= r * volume * .3;

    // Modulation
    if (modulation) s *= 1 + Math.sin(tm) * modulation;

    // Bit crush
    if (bitCrush) s = Math.round(s * bitCrush) / bitCrush;

    // Tremolo
    if (tremolo) s *= 1 - tremolo + tremolo * Math.sin(PI2 * i / sampleRate * 8);

    b.push(s);
  }

  if (!b.length) return undefined;

  const buffer = ctx.createBuffer(1, b.length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let k = 0; k < b.length; k++) data[k] = b[k];

  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.connect(ctx.destination);
  node.start();
  return node;
}

/**
 * Returns the zzfx function as an inline JavaScript string (~900 bytes)
 * for injection into generated game HTML.
 */
export function getZzfxInlineSource(): string {
  return `// ZzFX Micro - MIT License - https://github.com/KilledByAPixel/ZzFX
let zzfxCtx;
function zzfx(v=1,r=.05,f=220,a=0,s=0,rl=.1,sh=0,sc=1,sl=0,ds=0,pj=0,pjt=0,rt=0,n=0,m=0,bc=0,dl=0,sv=1,dc=0,tr=0){
if(!zzfxCtx)zzfxCtx=new AudioContext();
const sr=zzfxCtx.sampleRate,P=Math.PI*2;
let S=sl*=500*P/sr/sr,F=f*=(1+r*2*Math.random()-r)*P/sr,b=[],t=0,tm=0,i=0,j=1,R=0,c=0,e,L;
a=a*sr+9;dc=dc*sr;s=s*sr;rl=rl*sr;dl=dl*sr;L=a+dc+s+rl+dl|0;
for(;i<L;i++){if(i<a)R=i/a;else if(i<a+dc)R=1+((i-a)/dc)*(sv-1);else if(i<a+dc+s)R=sv;else R=sv*(1-(i-a-dc-s)/rl);
if(dl&&i>L-dl)R*=(L-i)/dl;f+=sl+=ds;if(pj&&!(++c%(pjt*100|0))){f+=pj;F+=pj}
if(rt&&!(++j%(rt*100|0))){f=F;sl=S}t+=f;tm+=f*Math.abs(m);
e=t;if(sh===1)e=e%P>P/2?1:-1;else if(sh===2)e=Math.sin(e*e);else if(sh===3){e=((e%P)/P*2-1);e=(e>0?1:-1)*Math.pow(Math.abs(e),sc)}else if(sh===4)e=Math.sin(e)*Math.sin(e*.5);else e=Math.sin(e);
e*=(n?Math.random()*n:1)*R*v*.3;if(m)e*=1+Math.sin(tm)*m;if(bc)e=Math.round(e*bc)/bc;if(tr)e*=1-tr+tr*Math.sin(P*i/sr*8);b.push(e)}
if(!b.length)return;const buf=zzfxCtx.createBuffer(1,b.length,sr),d=buf.getChannelData(0);for(let k=0;k<b.length;k++)d[k]=b[k];
const nd=zzfxCtx.createBufferSource();nd.buffer=buf;nd.connect(zzfxCtx.destination);nd.start();return nd}`;
}
