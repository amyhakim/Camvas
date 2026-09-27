"""Original deterministic score and garden sound design; no samples or downloads."""
from pathlib import Path
import wave, json
import numpy as np

ROOT=Path(__file__).resolve().parent
SR=48000
N=15*SR
rng=np.random.default_rng(59321)
music=np.zeros((N,2),dtype=np.float64)
ambience=np.zeros_like(music)
watering=np.zeros_like(music)
def add(track,signal,start,pan=0):
    at=round(start*SR); size=min(len(signal),N-at)
    if size<=0:return
    track[at:at+size,0]+=signal[:size]*np.sqrt((1-pan)/2)
    track[at:at+size,1]+=signal[:size]*np.sqrt((1+pan)/2)
def note(midi,length,kind):
    t=np.arange(round(length*SR))/SR;f=440*2**((midi-69)/12)
    if kind=='pluck':
        y=sum(np.sin(2*np.pi*f*k*t+.07*k)*np.exp(-t*(1.9+k*.55))/(k**1.55) for k in range(1,9))
        y*=np.minimum(t/.007,1)
    elif kind=='piano':
        y=sum(np.sin(2*np.pi*f*k*np.sqrt(1+.00012*k*k)*t)*np.exp(-t*(.85+k*.18))/(k**2.0) for k in range(1,7))
        y*=1-np.exp(-t*65)
    else:
        y=(np.sin(2*np.pi*f*t)*np.exp(-t*1.6)+.24*np.sin(2*np.pi*f*2.756*t)*np.exp(-t*3.5))*(1-np.exp(-t*150))
    y*=np.minimum((length-t)/.1,1)
    return y
# 80 BPM, five three-second measures. Cmaj7 → Am7 → Fmaj7 → G6 → C6.
chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59],[48,55,60,64]]
for bar,chord in enumerate(chords):
    for j,k in enumerate([0,2,1,3,1,2,3,2]):
        add(music,.063*note(chord[k]+12,2.1,'pluck'),bar*3+j*.375+.06,pan=-.32)
    for k in [0,2,3]:add(music,.048*note(chord[k],3.7,'piano'),bar*3+.03,pan=.15)
melody=[(0.75,76),(1.875,74),(3.75,72),(5.25,71),(6.75,69),(8.25,72),(9.75,71),(10.875,74),(12.3,72)]
for at,midi in melody:add(music,.055*note(midi,2.4,'piano'),at,.3)
for at,midi in [(2.35,83),(7.85,81),(12.35,84)]:add(music,.018*note(midi,2.5,'bell'),at,.5)
# A restrained stereo rustle, and a handful of distant synthetic bird phrases.
noise=rng.normal(size=N)
rustle=np.convolve(noise,np.ones(240)/240,mode='same')
for ch in range(2):ambience[:,ch]=np.roll(rustle,ch*1307)*.026
for at,base in [(1.5,2200),(5.9,2600),(11.8,2050)]:
    for j in range(2):
        t=np.arange(int(.16*SR))/SR
        chirp=np.sin(2*np.pi*(base*t+2100*t*t))*(np.sin(np.pi*t/.16)**2)*.007
        add(ambience,chirp,at+j*.23,-.6)
# Pour texture plus tiny drips, placed precisely under visible water.
length=3.13;t=np.arange(round(length*SR))/SR
white=rng.normal(size=len(t));low=np.convolve(white,np.ones(18)/18,mode='same')
env=np.minimum(t/.18,1)*np.minimum((length-t)/.22,1)
pour=(low+.10*white)*env*.038
add(watering,pour,7.65,.05)
for at in np.arange(7.72,10.75,.13):
    t=np.arange(round(.08*SR))/SR;freq=rng.uniform(900,1600)
    drip=np.sin(2*np.pi*(freq*t-2500*t*t))*np.exp(-t*65)*.014
    add(watering,drip,float(at),.1)
fade=np.minimum(np.arange(N)/SR/1.2,1)*np.minimum((15-np.arange(N)/SR)/1.2,1)
tracks={'music':music,'ambience':ambience,'watering':watering,'mix':music+ambience+watering}
report={}
for name,track in tracks.items():
    track*=fade[:,None]
    # Fixed gain preserves balance; no hard clipping or independent stem normalization.
    track*=2.2
    report[name]={'peak_dbfs':float(20*np.log10(max(np.max(abs(track)),1e-9))),'rms_dbfs':float(20*np.log10(max(np.sqrt(np.mean(track**2)),1e-9)))}
    assert np.max(abs(track))<.95
    with wave.open(str(ROOT/'assets'/f'{name}.wav'),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((track*32767).astype('<i2').tobytes())
(ROOT/'output'/'audio-analysis.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
