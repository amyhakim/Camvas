"""Original deterministic 110 BPM score, synthesized from oscillators and seeded noise.
No samples, external recordings, or third-party composition. PCM stems are editable.
"""
import numpy as np, wave
from pathlib import Path
SR=48000; DUR=15; N=SR*DUR; BEAT=60/110
rng=np.random.default_rng(110927)
mix=np.zeros((N,2),np.float64)
def put(sig,start,amp=1,pan=0,bus=mix):
 i=round(start*SR);end=min(N,i+len(sig))
 if i<0 or i>=N:return
 bus[i:end,0]+=sig[:end-i]*amp*np.sqrt((1-pan)/2)
 bus[i:end,1]+=sig[:end-i]*amp*np.sqrt((1+pan)/2)
def time(d):return np.arange(round(d*SR))/SR
def hz(note):return 440*2**((note-69)/12)
def kick():
 t=time(.38);phase=2*np.pi*(47*t+100*.026*(1-np.exp(-t/.026)))
 return np.sin(phase)*np.exp(-t*12)+.12*rng.normal(size=len(t))*np.exp(-t*180)
def snare():
 t=time(.25);n=rng.normal(size=len(t));n=np.r_[0,np.diff(n)]*.45
 return .65*n*np.exp(-t*24)+.35*np.sin(2*np.pi*180*t)*np.exp(-t*30)
def hat(open=False):
 t=time(.21 if open else .07);n=rng.normal(size=len(t));return np.r_[0,np.diff(n)]*.35*np.exp(-t*(22 if open else 65))
def bass(note,d):
 t=time(d);f=hz(note);e=np.minimum(t/.012,1)*np.minimum((d-t)/.055,1)
 return (.85*np.sin(2*np.pi*f*t)+.19*np.sin(4*np.pi*f*t)+.07*np.sin(6*np.pi*f*t))*e
def chord(notes,d):
 t=time(d);e=np.minimum(t/.025,1)*np.exp(-t*3.5)*np.minimum((d-t)/.10,1);a=np.zeros_like(t)
 for note in notes:
  f=hz(note);a+=(np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*1.003*t)+.15*np.sin(4*np.pi*f*t))/len(notes)
 return a*e
def pluck(note):
 t=time(.7);f=hz(note);return (np.sin(2*np.pi*f*t+.8*np.sin(2*np.pi*f*2*t)*np.exp(-t*9))+.16*np.sin(2*np.pi*3*f*t))*np.minimum(t/.005,1)*np.exp(-t*7)
roots=[38,34,41,36];chords=[[62,65,69,72],[62,65,69,70],[60,64,65,69],[60,62,64,67]]
for b in range(28):
 t=b*BEAT
 put(kick(),t,.56)
 if b%4 in [1,3]:put(snare(),t,.31,.02)
 put(hat(),t,.115,-.25);put(hat(b%4==3),t+BEAT*.51,.15,.28)
 root=roots[(b//8)%4]
 put(bass(root,.30),t+BEAT*.04,.25)
 if b%2==1:put(bass(root+12,.19),t+BEAT*.63,.14)
 if b%2==0:
  s=chord(chords[(b//8)%4],.65);put(s,t+BEAT*.5,.19,-.25);put(s,t+BEAT*.5+.015,.16,.35)
melody=[74,77,81,77,79,77,74,72,74,77,81,84,81,79]
for j,n in enumerate(melody):
 t=(j*2+.5)*BEAT;v=pluck(n);put(v,t,.092,(-1)**j*.4);put(v,t+BEAT*.75,.023,(-1)**(j+1)*.5)
put(chord([62,65,69,74],1.6),13.09,.23)
fade=np.minimum(np.arange(N)/SR/.22,1)*np.minimum((DUR-np.arange(N)/SR)/.8,1)
mix*=fade[:,None]
foley=np.zeros_like(mix)
for j,t0 in enumerate([3.10,3.48,5.10,7.52,8.13,10.5,11.35]):
 t=time(.12);n=rng.normal(size=len(t));n=np.convolve(n,np.ones(9)/9,'same');s=.6*n*np.sin(np.pi*t/.12)**2+.14*np.sin(2*np.pi*(620*t-220*t*t))*np.exp(-t*32)
 put(s,t0,.025,(-1)**j*.1,bus=foley)
out=Path(__file__).parent/'assets'
def save(name,data):
 with wave.open(str(out/name),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
save('music-original-110bpm.wav',mix);save('shoe-foley.wav',foley);save('mix-premaster.wav',mix+foley)
print('15 s stereo stems written. Premaster peak:',20*np.log10(np.max(np.abs(mix+foley))),'dBFS')
