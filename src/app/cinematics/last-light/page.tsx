import Link from 'next/link';
import styles from './page.module.css';

export const metadata = { title: 'Last Light — Showcam cinematic' };

export default async function LastLight({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const live = (await searchParams).view === 'scene';
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">showcam<span>.</span></Link><span>CINEMATIC PROJECT · 001</span><Link href="/editor?scene=last-light">Open in editor ↗</Link></header>
    <section className={styles.heading}><div><p>ONE LAST DRIVE BEFORE DARK</p><h1>Last Light</h1></div><span>15 seconds · 1080p · 24 fps</span></section>
    <nav className={styles.tabs} aria-label="Cinematic view"><Link aria-current={!live ? 'page' : undefined} href="/cinematics/last-light">Finished film</Link><Link aria-current={live ? 'page' : undefined} href="/cinematics/last-light?view=scene">Live scene & timeline</Link></nav>
    <div className={styles.screen}>{live ? <iframe title="Last Light editable PlayCanvas scene" src="/films/last-light/index.html" allow="autoplay; fullscreen" /> : <video controls playsInline preload="metadata" poster="/films/last-light/preview.png"><source src="/films/last-light/last-light.mp4" type="video/mp4" /><track kind="captions" src="/films/last-light/captions.vtt" srcLang="en" label="Sound descriptions" />Your browser does not support video playback.</video>}</div>
    <section className={styles.footer}><p>A turquoise brick-built beach car, one hurried driver, and the quiet coast at golden hour.</p><div><a href="/films/last-light/last-light.mp4" download>Download MP4 ↓</a><a href="/films/last-light/last-light-project.zip" download>Editable project ↓</a><a href="/films/last-light/verification.md">Verification report ↗</a></div></section>
    <ol className={styles.shots}><li><span>00—03</span>Arrive</li><li><span>03—07</span>Climb in</li><li><span>07—10</span>Settle & start</li><li><span>10—15</span>Chase the sunset</li></ol>
    <p className={styles.credit}>Car reference: Renderbricks, “LEGO® 10252 Volkswagen Beetle,” CC BY 4.0. Independent procedural approximation.</p>
  </main>;
}
