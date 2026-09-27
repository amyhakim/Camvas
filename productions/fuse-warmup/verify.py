"""Verify the delivered movie and deterministic frame audit. Run after render.mjs final."""
import json, subprocess, hashlib, zlib, zipfile, re
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent
movie=root/'output/fuse-warmup.mp4'
def run(args):return subprocess.run(args,check=True,capture_output=True)
probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]).stdout)
video=next(x for x in probe['streams'] if x['codec_type']=='video')
audio=next(x for x in probe['streams'] if x['codec_type']=='audio')
assert (video['width'],video['height'],video['r_frame_rate'],int(video['nb_frames']))==(1920,1080,'24/1',360)
assert abs(float(video['duration'])-15)<1e-6 and abs(float(audio['duration'])-15)<.001
assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
assert audio['codec_name']=='aac' and audio['sample_rate']=='48000' and audio['channels']==2
decode=run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'])
assert not decode.stderr,decode.stderr
hashes=run(['ffmpeg','-v','error','-i',str(movie),'-map','0:v','-f','framemd5','-']).stdout.decode()
rows=[r for r in hashes.splitlines() if not r.startswith('#')]
assert len(rows)==360
unique=len(set(r.split(',')[-1].strip() for r in rows))
assert unique==360,'Repeated encoded frames'
(root/'output/frame-hashes.txt').write_text(hashes)
audit=json.loads((root/'output/fuse-warmup-audit.json').read_text());frames=audit['frames']
assert len(frames)==360 and not audit['errors']
foot_drift=max(abs(x['feet'][s][j]-frames[0]['feet'][s][j]) for x in frames for s in range(2) for j in range(3))
assert foot_drift<1e-9
bounds=[min(x['min'][0] for x in frames),min(x['min'][1] for x in frames),max(x['max'][0] for x in frames),max(x['max'][1] for x in frames)]
assert bounds[0]>0 and bounds[1]>0 and bounds[2]<1920 and bounds[3]<1080
bottoms=[];above=False
for f in frames:
 if f['q']>.99 and not above:bottoms.append(f['time']);above=True
 if f['q']<.99:above=False
assert len(bottoms)==2 and 5<bottoms[0]<8 and 8<bottoms[1]<11
pcm=run(['ffmpeg','-v','error','-i',str(movie),'-map','0:a','-f','f32le','-']).stdout
samples=np.frombuffer(pcm,dtype='<f4').reshape(-1,2)
peak=float(np.abs(samples).max());assert peak<1
levels=run(['ffmpeg','-hide_banner','-i',str(movie),'-af','ebur128=peak=true:framelog=verbose','-f','null','-']).stderr.decode()
(root/'output/audio-measurement.txt').write_text(levels)
summary=levels.split('Summary:')[-1].split('[out#')[0].strip()
source=root/'assets/FUSEgym.zip';sha=hashlib.sha256();crc=0
with zipfile.ZipFile(source) as z, z.open('scene.ply') as f:
 for block in iter(lambda:f.read(4*1024*1024),b''):sha.update(block);crc=zlib.crc32(block,crc)
archive=Path('/Users/wes/Downloads/FUSEgym.zip')
source_verified=None
if archive.exists():
 with zipfile.ZipFile(archive) as z:source_verified=(z.getinfo('scene.ply').CRC==crc)
 assert source_verified
report={'movie':str(movie),'video':{'codec':video['codec_name'],'width':1920,'height':1080,'fps':24,'frames':360,'duration':15,'uniqueDecodedFrames':unique},'audio':{'codec':audio['codec_name'],'sampleRate':48000,'channels':2,'duration':15,'decodedSamplePeakDbFS':float(20*np.log10(peak)),'clippedSamples':int((np.abs(samples)>=1).sum()),'measurement':summary},'browserErrors':audit['errors'],'maxFootDriftMetres':foot_drift,'projectedWholeBodyBoundsPixels':bounds,'squatBottomStartSeconds':bottoms,'sourceSha256':sha.hexdigest(),'sourceMatchesArchiveCRC':source_verified,'completeDecode':'passed'}
(root/'output/verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
