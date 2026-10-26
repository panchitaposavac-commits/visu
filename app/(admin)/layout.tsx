'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Plus,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Inicio',
    shortLabel: 'Inicio',
    href: '/',
    icon: Home,
  },
  {
    label: 'Nuevo Ingreso',
    shortLabel: 'Nuevo',
    href: '/recepcion',
    icon: Plus,
  },
  {
    label: 'Historial de Órdenes',
    shortLabel: 'Historial',
    href: '/ordenes',
    icon: ClipboardList,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Detecta si el formulario de recepción está activo para ocultar la barra inferior por ruta
  const isFormActive = pathname === '/recepcion' || pathname?.startsWith('/recepcion');
  const isDashboard = pathname === '/';

  const handleLogout = () => {
    router.push('/');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased selection:bg-visu-mint selection:text-slate-950 print:bg-white print:min-h-0 print:text-black">
      {/* ============================================================ */}
      {/* 1. SIDEBAR ESCRITORIO (Fija a la izquierda en md/lg)          */}
      {/* ============================================================ */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-visu-blue text-white border-r border-blue-900/50 shrink-0 select-none print:hidden shadow-xl">
        {/* Header de la Sidebar con Logo Oficial */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
          <Link href="/recepcion" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <Image
              src="/visu-logo-white.png"
              alt="Visú"
              width={130}
              height={48}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>
          <span className="text-[10px] font-bold tracking-wider uppercase bg-visu-mint text-slate-950 px-2 py-0.5 rounded shadow-xs">
            Taller Pro
          </span>
        </div>

        {/* Navegación Principal Desktop */}
        <div className="flex-1 py-6 px-3 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            <div className="px-3 mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200/70">
                Módulos Operativos
              </p>
            </div>

            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white/10 text-white font-bold shadow-xs border-l-4 border-visu-mint pl-2.5'
                        : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive
                            ? 'text-visu-mint'
                            : 'text-blue-200 group-hover:text-white'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-visu-mint text-slate-950'
                            : 'bg-blue-900/60 text-blue-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Tarjeta Informativa / Estado Taller */}
          <div className="p-3.5 bg-blue-950/40 border border-blue-800/50 rounded-xl">
            <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5 text-visu-mint" />
              <span>Modo Terreno & Taller</span>
            </div>
            <p className="text-[11px] text-blue-200/80 leading-relaxed">
              Captura fotos de inspección directamente con la cámara de tu smartphone.
            </p>
          </div>
        </div>

        {/* Footer de Sidebar */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-blue-950/40 border border-blue-800/50">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-blue-800/80 flex items-center justify-center text-white font-bold text-xs">
                AD
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-visu-mint border-2 border-visu-blue rounded-full"></span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-white truncate">
                Admin Taller
              </span>
              <span className="text-[10px] text-blue-200/80 truncate">
                Recepción & Diagnóstico
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-blue-200 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. HEADER SUPERIOR COMPACTO (Mobile & Desktop)              */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 print:w-full print:block">
        <header className={`h-14 md:h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-2xs print:hidden ${isDashboard ? 'hidden md:flex' : 'flex'}`}>
          {/* Logo y Nombre en Móvil (Se oculta en móvil cuando el formulario está activo) */}
          <div className="flex items-center gap-2.5">
            <div className={`items-center ${isFormActive ? 'hidden md:flex' : 'flex md:hidden'}`}>
              <Link href="/recepcion" className="flex items-center gap-2">
                <Image
                  src="/visu-logo.png"
                  alt="Visú"
                  width={110}
                  height={40}
                  priority
                  className="h-7 w-auto object-contain"
                />
              </Link>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider bg-visu-mint/20 text-visu-blue px-2 py-0.5 rounded border border-visu-mint/40 ${isFormActive ? 'hidden md:inline-block' : 'hidden sm:inline-block'}`}>
              Terreno
            </span>
          </div>

          {/* Estado de Conexión & Salida (Banner 'En Línea' se oculta en móvil con hidden md:flex cuando el form está activo) */}
          <div className="flex items-center gap-3">
            <div className={`items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 ${isFormActive ? 'hidden md:flex' : 'flex'}`}>
              <span className="w-2 h-2 rounded-full bg-visu-mint animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-700 hidden sm:inline">En Línea</span>
              <ShieldCheck className="w-3.5 h-3.5 text-visu-mint sm:hidden" />
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Salir"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 3. CONTENEDOR PRINCIPAL FLUIDO CON SAFE BOTTOM PADDING      */}
        {/* ============================================================ */}
        <main className={`flex-1 w-full max-w-5xl mx-auto p-3.5 sm:p-6 md:p-8 overflow-x-hidden print:p-0 print:max-w-none print:m-0 print:overflow-visible print:w-full ${
          isFormActive ? 'pb-8' : 'pb-28 md:pb-8'
        }`}>
          {children}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 4. BARRA DE NAVEGACIÓN INFERIOR FIJA (BOTTOM BAR - MOBILE)  */}
      {/* ============================================================ */}
      <nav
        aria-label="Navegación móvil inferior"
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-1.5 items-center justify-around shadow-lg select-none print:hidden transition-all duration-300 ease-in-out ${
          isFormActive
            ? 'hidden'
            : 'flex'
        }`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-visu-blue font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`w-10 h-7 rounded-full flex items-center justify-center transition-colors mb-0.5 ${
                  isActive ? 'text-visu-blue' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

