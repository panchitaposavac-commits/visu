import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Visú - Gestión de Talleres Mecánicos',
  description: 'Trazabilidad y digitalización de servicios mecánicos de extremo a extremo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}