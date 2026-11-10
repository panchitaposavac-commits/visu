import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Visú - Gestión de Talleres Mecánicos',
  description: 'Trazabilidad y digitalización de servicios mecánicos de extremo a extremo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}