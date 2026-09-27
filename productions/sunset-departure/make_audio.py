"""Original synthesized score and foley. No sampled recordings or external music."""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR=48000
rng=np.random.default_rng(10252)
t=np.arange(SR*15)/SR
audio=np.zeros((len(t),2))
def add(sig,start=0,pan=0,gain=1):
    offset=int(start*SR);count=min(len(sig),len(t)-offset)
    if count<=0:return
    audio[offset:offset+count,0]+=sig[:count]*gain*np.sqrt((1-pan)/2)
    audio[offset:offset+count,1]+=sig[:count]*gain*np.sqrt((1+pan)/2)
def noise(n,cut):
    return sosfilt(butter(2,cut,fs=SR,output='sos'),rng.normal(size=n))

# Quiet stereo shoreline, gradually widening during the final shot.
for ch in range(2):
    surf=noise(len(t),1700)
    envelope=.015+.012*(.5+.5*np.sin(t*.84+ch*.7))**2
    audio[:,ch]+=surf*envelope
# Soft, original major-sixth pad and wooden plucks.
for start,notes in [(0,[146.832,220,293.665,369.994]),(4,[130.813,196,261.626,329.628]),(8,[164.814,220,329.628,440]),(11.5,[146.832,220,293.665,369.994])]:
    n=min(int(4.5*SR),len(t)-int(start*SR));u=np.arange(n)/SR
    env=np.minimum(u/.8,1)*np.minimum((n/SR-u)/1.2,1)
    chord=sum(np.sin(2*np.pi*f*u+.12*np.sin(2*np.pi*.4*u)) for f in notes)/len(notes)
    add(chord*env,start,pan=-.15,gain=.034)
for start,f in [(0.35,587.33),(1.1,739.99),(2.0,880),(3.1,739.99),(4.8,659.255),(6.0,783.991),(8.4,880),(10.3,659.255),(11.2,587.33),(12.0,739.99),(13.0,880),(14.0,1174.66)]:
    u=np.arange(int(1.0*SR))/SR
    pluck=(np.sin(2*np.pi*f*u)+.2*np.sin(2*np.pi*f*2*u))*np.exp(-u*5)*np.minimum(u/.008,1)
    add(pluck,start,pan=.2,gain=.035)
# Quick plastic footfalls, a handle click, and a weighted door close.
for start in np.arange(.7,3.36,1/4.4):
    u=np.arange(int(.08*SR))/SR
    step=(noise(len(u),2200)*.35+np.sin(2*np.pi*170*u)*.24)*np.exp(-u*65)
    add(step,float(start),pan=-.35,gain=.16)
for start,gain in [(3.8,.10),(4.45,.06),(5.2,.08),(6.3,.07),(7.72,.25)]:
    u=np.arange(int(.22*SR))/SR
    hit=(noise(len(u),3200)*.5+np.sin(2*np.pi*(110*u-85*u*u))*.45)*np.exp(-u*28)
    add(hit,start,pan=.1,gain=gain)
# Low toy-engine pulse and airy tire roll follow actual vehicle departure.
u=np.maximum(0,t-8.6)
phase=2*np.pi*(40*u+4*u*u)
engine=(np.sin(phase)+.3*np.sin(2*phase))*.018
env=np.clip(u/.6,0,1)*np.clip((15-t)/1.6,0,1)
add(engine*env,pan=.25)
add(noise(len(t),700)*np.clip((t-9)/2,0,1)*np.clip((15-t)/1,0,1),gain=.025)
audio*=np.minimum(t/.35,1)[:,None]*np.minimum((15-t)/.7,1)[:,None]
audio=np.tanh(audio*1.2)
out=Path(__file__).parent/'assets'/'soundtrack.wav'
with wave.open(str(out),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((audio*32767).astype('<i2').tobytes())
print(f'{out}: {len(t)/SR:.3f}s, stereo {SR} Hz, peak {abs(audio).max():.4f}')
