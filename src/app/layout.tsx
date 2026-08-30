import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Montreal Private Secondary Open Days',
  description: 'Open houses and entrance exams, in one place.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
