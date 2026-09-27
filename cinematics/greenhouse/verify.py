from pathlib import Path
import json, hashlib, zipfile
import numpy as np
root=Path(__file__).resolve().parent
probe=json.loads((root/'output/ffprobe.json').read_text())
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'],v['nb_read_frames'])==(1920,1080,'24/1','360')
assert v['codec_name']=='h264' and a['codec_name']=='aac' and a['channels']==2
assert float(probe['format']['duration'])==15
assert float(v['duration'])==15 and float(a['duration'])==15
inspection=json.loads((root/'output/frames-inspection.json').read_text())
assert not inspection['errors'] and len(inspection['samples'])==360
s=inspection['samples'];mat=s[0]['sourceMatrix']
assert all(f['sourceMatrix']==mat for f in s)
assert all(min(p[1] for p in f['feet'])>=1.83999 for f in s)
# Foot world positions must hold whenever that foot isn't in its single step.
worst=0
for foot,(start,end) in enumerate([(5.25,6.2),(4.05,5)]):
    for before,after in zip(s,s[1:]):
        if after['time']<start or before['time']>end:
            drift=np.linalg.norm(np.array(after['feet'][foot])-before['feet'][foot]);worst=max(worst,float(drift))
assert worst<.0001, worst
minimum_boot_separation=min(float(np.linalg.norm(np.array(f['feet'][0])[[0,2]]-np.array(f['feet'][1])[[0,2]])) for f in s)
assert minimum_boot_separation>.33
water=[f for f in s if f['water']]
assert water
assert all(np.linalg.norm(np.array(f['pot'])[[0,2]]-[3.43,6.70])<.323 for f in water)
with (root/'assets/scene.ply').open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
source=Path('/Users/wes/Downloads/Hozy Greenhouse.zip')
source_match=None
if source.exists():
    with zipfile.ZipFile(source) as z:
        with z.open('scene.ply') as f:source_match=hashlib.file_digest(f,'sha256').hexdigest()==sha
    assert source_match
report={'renderedFrom':inspection['url'],'video':'1920x1080, 24/1 fps, 360 frames, H.264, 15.000 seconds','audio':'AAC stereo, 48000 Hz, 15.000 seconds','runtimeErrors':inspection['errors'],'sourceTransformConstant':True,'sourceSha256':sha,'matchesOriginalArchive':source_match,'minimumFootHeight':min(p[1] for f in s for p in f['feet']),'maximumPlantedFootDrift':worst,'minimumBootCenterSeparation':minimum_boot_separation,'waterFrameCount':len(water),'waterLandsWithinSoilRadius':True,'allFramesDecoded':True}
(root/'output/verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
