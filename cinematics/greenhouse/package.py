"""Package the complete editable cinematic, its source asset, and verified deliveries."""
from pathlib import Path
import zipfile,hashlib,json
root=Path(__file__).resolve().parent
target=root/'A-Little-Tending-project.zip'
keep_outputs={'A-Little-Tending.mp4','preview.png','verification.json','ffprobe.json','frames-inspection.json','encoded-audio-analysis.txt','decode-check.txt','audio-analysis.json','home-check.json','browser-playback.json','project-home.png','browser-playback.png','native-editor.png','native-editor-check.json','native-production-check.json','native-production-9.png','native-flight-controls.png','native-review.jpg'}
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=2) as z:
    for p in sorted(root.rglob('*')):
        if not p.is_file() or p.suffix=='.zip' or '__pycache__' in p.parts or 'node_modules' in p.parts:continue
        rel=p.relative_to(root)
        if rel.parts[0]=='output' and p.name not in keep_outputs and 'review' not in rel.parts:continue
        z.write(p,Path('A-Little-Tending')/rel)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert 'A-Little-Tending/assets/scene.ply' in z.namelist()
    assert 'A-Little-Tending/output/A-Little-Tending.mp4' in z.namelist()
with target.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
(root/'output/package-verification.json').write_text(json.dumps({'archive':target.name,'bytes':target.stat().st_size,'sha256':digest,'crcCheck':'passed'},indent=2))
print(target, target.stat().st_size, digest)
