import type { Metadata } from 'next';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './globals.css';
import { Providers } from './providers';


// Display/heading face — a characterful grotesk that gives the brand a premium,
// editorial voice while staying close to Geist's geometry for the body.

export const metadata: Metadata = {
  title: {
    default: 'GRS Learning — Learn anything, anywhere',
    template: '%s | GRS Learning',
  },
  description:
    'A modern course platform: world-class courses, protected video, progress tracking, and region-fair pricing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

