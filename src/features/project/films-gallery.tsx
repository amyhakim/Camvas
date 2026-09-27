import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WorkspaceNav } from './workspace-nav';
import styles from './films-gallery.module.css';

const galleryVideos = [
  { title: 'Skyline Slalom', description: 'A San Francisco flight with a close pigeon encounter.', src: '/films/skyline-slalom/skyline-slalom.mp4', poster: '/films/skyline-slalom/preview.jpg', href: '/editor?scene=pavilion-v1&project=58adec1e-180c-4888-91fc-7b41bbda301f&entry=scene%3Askyline-slalom', credits: '/films/skyline-slalom/credits.txt' },
  { title: 'Thames Air', description: 'Through Tower Bridge into a sweeping London panorama.', src: '/films/thames-air/thames-air.mp4', poster: '/films/thames-air/preview.jpg', href: '/editor?scene=supersplat-c1706d30-v1&project=da67b874-93e5-499e-abc5-8bb29890bfbb&entry=scene%3Athames-air', credits: '/films/thames-air/credits.txt' },
  { title: 'Last Light', description: 'A golden-hour departure on the coast.', src: '/films/last-light/last-light.mp4', poster: '/films/last-light/preview.png', href: '/cinematics/last-light', captions: '/films/last-light/captions.vtt' },
  { title: 'Fuse Warmup', description: 'A character study inside a scanned gym.', src: '/fuse-warmup/output/fuse-warmup.mp4', poster: '/fuse-warmup/output/preview-frame.png', href: '/fuse-warmup/index.html' },
  { title: 'A Little Tending', description: 'A quiet flight through a greenhouse garden.', src: '/greenhouse/output/A-Little-Tending.mp4', poster: '/greenhouse/output/preview.png', href: '/cinematics/greenhouse' },
] as const;

export function FilmsGallery() {
  return <main id="main" className={styles.shell}>
    <WorkspaceNav active="films" />
    <div className={styles.content}>
      <div className={styles.heading}><div><span className={styles.eyebrow}>FILMS</span><h1>Scenes in motion<span>.</span></h1><p>Watch the finished views, then explore the projects behind them.</p></div></div>
      <div className={styles.grid}>{galleryVideos.map(video => <article className={styles.card} key={video.title}>
        <div className={styles.frame}><video controls playsInline preload="none" poster={video.poster} aria-label={`${video.title} video`}><source src={video.src} type="video/mp4" />{'captions' in video && <track kind="captions" src={video.captions} srcLang="en" label="Sound descriptions" />}Your browser does not support video playback.</video></div>
        <div className={styles.details}><div><h2>{video.title}</h2><p>{video.description}</p>{'credits' in video && <a className={styles.credits} href={video.credits} aria-label={`${video.title} credits`}>Credits</a>}</div><Link href={video.href} aria-label={`Explore ${video.title}`}><ArrowRight size={18} /></Link></div>
      </article>)}</div>
    </div>
  </main>;
}
