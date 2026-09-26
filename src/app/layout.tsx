import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '@/styles/tokens.css';
import '@/styles/globals.css';
import { PreferencesProvider } from '@/components/ui/preferences';

export const metadata: Metadata = { title: 'Showcam — Scene studies', description: 'A rounded glass design system for scene exploration, camera timing, and previs.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><PreferencesProvider>{children}</PreferencesProvider></body></html>;
}
