import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'EduPass · Présence intelligente',
  description: 'La présence scolaire, simplement. Gestion des élèves, des cours et des bornes NFC.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
