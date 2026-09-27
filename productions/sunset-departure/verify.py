"""Verify the baked animation, GLB structure and encoded media. Python stdlib + FFmpeg."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess

base=Path(__file__).resolve().parent
delivery=base/'delivery'
audit=json.loads((base/'final-audit.json').read_text())
states=audit['states']
assert len(states)==360 and not audit['errors']
assert all(s['characterCount']==1 for s in states)
assert [sum(s['shot']==i for s in states) for i in range(1,5)]==[72,96,72,120]
assert all(abs(min(f['min'][1] for f in s['feet'])-.014)<1e-5 for s in states if s['time']<4.45)
assert max(s['hair']['max'][1] for s in states if 5.5<=s['time']<=7)<1.96
assert min(min(f['min'][1] for f in s['feet']) for s in states if s['time']>=7)>.61
assert all(s['doorDegrees']==0 for s in states if s['time']>=7.75)
assert all(s['carX']==0 for s in states if s['time']<=9)
assert states[-1]['carX']>13

glb=(base/'assets'/'last-light.glb').read_bytes()
magic,version,total=struct.unpack_from('<III',glb)
assert magic==0x46546c67 and version==2 and total==len(glb)
size,kind=struct.unpack_from('<II',glb,12)
assert kind==0x4e4f534a
doc=json.loads(glb[20:20+size])
binary_length,binary_kind=struct.unpack_from('<II',glb,20+size)
assert binary_kind==0x004e4942 and binary_length==doc['buffers'][0]['byteLength']
for view in doc['bufferViews']:
    assert view.get('byteOffset',0)+view['byteLength']<=binary_length
for animation in doc['animations']:
    for channel in animation['channels']:
        assert channel['target']['node']<len(doc['nodes'])
        sampler=animation['samplers'][channel['sampler']]
        assert doc['accessors'][sampler['input']]['count']==doc['accessors'][sampler['output']]['count']
assert sum(n.get('extras',{}).get('entityId')=='last-light:driver' for n in doc['nodes'])==1

movie=delivery/'last-light.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(movie)]))
video=next(s for s in probe['streams'] if s['codec_type']=='video')
assert (video['width'],video['height'],video['r_frame_rate'],video['nb_read_frames'])==(1920,1080,'24/1','360')
assert probe['format']['duration']=='15.000000'
subprocess.run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'],check=True)
report={'ffprobe':probe,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'glb':{'bytes':len(glb),'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'animationChannels':len(doc['animations'][0]['channels']),'bufferAndChannelChecks':'passed'},'animationAssertions':'passed','fullDecode':'passed'}
(delivery/'media-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 360 frames, 1920×1080, 24 fps, 15 seconds; one character; animation clearances; GLB structure; full decode.')
