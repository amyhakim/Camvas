import type { StoryboardShot } from '../../contracts';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function contactSheet(name: string, shots: StoryboardShot[], images: string[], lenses: number[]): Promise<Blob> {
  const canvas = document.createElement('canvas'), columns = 2, cellWidth = 640, cellHeight = 500, gap = 32;
  canvas.width = columns * cellWidth + (columns + 1) * gap;
  canvas.height = 100 + Math.ceil(shots.length / columns) * (cellHeight + gap);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image export is unavailable.');
  context.fillStyle = '#f5f4ef'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#1c2521'; context.font = 'bold 28px sans-serif'; context.fillText(name, gap, 52, canvas.width - gap * 2);
  const wrap = (text: string, x: number, y: number, rows: number) => {
    let line = '', row = 0;
    for (const word of text.replace(/\s+/g, ' ').split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > cellWidth) {
        context.fillText(row === rows - 1 ? `${line.slice(0, -1)}…` : line, x, y + row * 24, cellWidth);
        if (++row >= rows) return;
        line = word;
      } else line = next;
    }
    if (line) context.fillText(line, x, y + row * 24, cellWidth);
  };
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i], image = new Image(); image.src = images[i]; await image.decode();
    const x = gap + (i % columns) * (cellWidth + gap), y = 90 + Math.floor(i / columns) * (cellHeight + gap);
    context.drawImage(image, x, y, cellWidth, 360);
    context.fillStyle = '#1c2521'; context.font = 'bold 22px sans-serif';
    context.fillText(`${i + 1}. ${shot.name}`, x, y + 393, cellWidth);
    context.font = '18px sans-serif';
    context.fillText(`${Math.round(lenses[i] * 10) / 10} mm · ${shot.camera.settings.duration} s · scene ${shot.sceneStart}s · panel ${shot.panelTime}s`, x, y + 421, cellWidth);
    wrap(shot.notes, x, y + 450, 3);
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The storyboard could not be exported.')), 'image/png'));
}
