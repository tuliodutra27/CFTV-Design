import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CFTV Design — ALISEO',
  description: 'Plataforma de projeto de CFTV: posicionamento de câmeras, FOV e cobertura.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
