import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ignoreDefaultArgs: ['--mute-audio'], args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.audioProbes = [];
  window.audioVoices = [];
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const voice = { source: this, stopped: false, ended: false }; window.audioVoices.push(voice);
    this.addEventListener('ended', () => { voice.ended = true; });
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const voice = window.audioVoices.find(v => v.source === this); if(voice)voice.stopped = true;
    return stop.apply(this, args);
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    if (destination instanceof AudioDestinationNode) {
      const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
      connect.call(this, analyser); connect.call(analyser, destination);
      window.audioProbes.push(analyser); return destination;
    }
    return connect.call(this, destination, ...args);
  };
});
async function rms() {
  return page.evaluate(() => Math.max(0, ...window.audioProbes.map(probe => {
    const samples = new Float32Array(probe.fftSize); probe.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, x) => sum + x*x, 0) / samples.length);
  })));
}
try {
  await page.goto('http://localhost:3000/');
  await page.evaluate(() => {
    localStorage.setItem('showcam-project:item:v1:last-light-cinematic', JSON.stringify({ format: 'showcam-collection', version: 1, name: 'My Last Light edit', scenes: [{ id: 'scene:last-light', name: 'Beach departure', document: { format: 'showcam-project', version: 1, sceneId: 'last-light', name: 'My Last Light edit', shot: null, actors: [], placements: [{ id: 'last-light:car', offset: [.1,0,0] }] } }] }));
  });
  await page.goto('http://localhost:3000/editor?scene=last-light&project=last-light-cinematic&entry=scene:last-light');
  console.log('Editor opened; waiting for soundtrack migration');
  await page.getByText('Audio credits (1)', { exact: true }).waitFor({ state: 'attached', timeout: 60000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('showcam-project:item:v1:last-light-cinematic')));
  assert.equal(saved.name, 'My Last Light edit');
  assert.deepEqual(saved.scenes[0].document.placements[0].offset, [.1,0,0]);
  assert.equal(saved.scenes[0].document.audio[0].source.provider, 'builtin');
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 120000 });
  console.log('Editor scene and audio loaded');
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.waitForFunction(() => window.audioProbes.some(probe => {
    const samples = new Float32Array(probe.fftSize); probe.getFloatTimeDomainData(samples);
    return samples.some(x=>Math.abs(x)>.001);
  }), undefined, {timeout:15000});
  const playingRms = await rms(); assert.ok(playingRms > .0001, `Editor signal RMS ${playingRms}`);
  await page.getByRole('slider', { name: /^(Timeline frame|Playback progress)$/ }).fill('241');
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.waitForTimeout(600);
  const seekRms = await rms(); assert.ok(seekRms > .0001, `Editor signal after seek ${seekRms}`);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await page.waitForFunction(() => window.audioVoices.length>0 && window.audioVoices.every(v=>v.stopped||v.ended));
  const activeVoicesAfterPause = await page.evaluate(()=>window.audioVoices.filter(v=>!v.stopped&&!v.ended).length);
  assert.equal(activeVoicesAfterPause, 0);
  await page.getByRole('button', { name: 'Render video', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Include timeline music and sound effects' }).isChecked(), true);
  await page.screenshot({ path: 'productions/sunset-departure/delivery/audio-editor.png' });

  await page.goto('http://localhost:3000/cinematics/last-light?view=scene');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(1400);
  const read = () => frame.locator('audio').evaluate(e => ({ paused: e.paused, muted: e.muted, time: e.currentTime, volume: e.volume, error: e.error?.message, timeline: Number(document.querySelector('#seek').value) }));
  const live = await read(); assert.ok(!live.paused && !live.muted && live.time > .3 && Math.abs(live.time-live.timeline)<.15);
  await frame.getByRole('slider', { name: 'Time', exact: true }).fill(String(192*.0416667));
  await page.waitForTimeout(300); const liveSeek = await read(); assert.ok(liveSeek.time>=8 && liveSeek.time<9);
  await frame.getByRole('button', { name: 'Pause', exact: true }).click();
  const livePaused = await read(); assert.equal(livePaused.paused, true);
  await frame.getByRole('button', { name: 'Mute soundtrack', exact: true }).click();assert.equal((await read()).muted, true);
  await frame.getByRole('button', { name: 'Unmute soundtrack', exact: true }).click();assert.equal((await read()).muted, false);
  const media = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const response = await fetch('/api/audio/builtin/last-light/file');
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const data = buffer.getChannelData(0), rms = Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);
    await ctx.close();return { status: response.status, duration: buffer.duration, channels: buffer.numberOfChannels, rms };
  });
  assert.equal(media.status, 200); assert.ok(Math.abs(media.duration-15)<.1 && media.rms>.001);
  assert.deepEqual(errors, []);
  const result={ migrationPreservedEdits: true, editor: { playingRms, seekRms, activeVoicesAfterPause, renderAudioEnabled: true }, live, liveSeek, livePaused, muteToggle: true, media, errors };
  await writeFile('productions/sunset-departure/delivery/audio-verification.json', JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch(error) { await page.screenshot({path:'productions/sunset-departure/delivery/audio-check-failure.png'}); console.log(await page.evaluate(()=>window.audioProbes.map(a=>({state:a.context.state,time:a.context.currentTime})))); console.log((await page.locator('body').innerText()).slice(-2500)); throw error; } finally { await browser.close(); }
