// Run from any directory. Requires FFmpeg.
import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const base=fileURLToPath(new URL('.',import.meta.url)).replace(/\/$/,'');
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r;}
run('ffmpeg',['-y','-hide_banner','-loglevel','warning','-i',`${base}/output/picture.mp4`,'-i',`${base}/assets/mix.wav`,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','15','-movflags','+faststart','-metadata','title=A Little Tending','-metadata','artist=Environment: Elias Duda; original procedural animation and music','-metadata','comment=Hozy Greenhouse by Elias Duda, CC BY 4.0. https://superspl.at/scene/592480a3',`${base}/output/A-Little-Tending.mp4`]);
const probe=run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',`${base}/output/A-Little-Tending.mp4`]);writeFileSync(`${base}/output/ffprobe.json`,probe.stdout);
const decoded=run('ffmpeg',['-v','error','-i',`${base}/output/A-Little-Tending.mp4`,'-f','null','-']);writeFileSync(`${base}/output/decode-check.txt`,decoded.stderr||'Full MP4 video and audio decode completed with no errors.\n');
const audio=run('ffmpeg',['-hide_banner','-i',`${base}/output/A-Little-Tending.mp4`,'-vn','-af','ebur128=peak=true','-f','null','-']);writeFileSync(`${base}/output/encoded-audio-analysis.txt`,audio.stderr);
mkdirSync(`${base}/output/review`,{recursive:true});
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',`${base}/output/A-Little-Tending.mp4`,'-vf','scale=480:270,tile=6x6','-fps_mode','vfr',`${base}/output/review/sheet-%02d.jpg`]);
console.log('Export, decode, audio analysis, preview, and all-frame review sheets complete.');
