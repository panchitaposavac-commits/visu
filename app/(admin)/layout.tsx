'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardPlus,
  Kanban,
  Wrench,
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
    label: 'Recepción de Vehículo',
    shortLabel: 'Recepción',
    href: '/recepcion',
    icon: ClipboardPlus,
    badge: 'Nuevo',
  },
  {
    label: 'Tablero de Órdenes',
    shortLabel: 'Órdenes',
    href: '/ordenes',
    icon: Kanban,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased selection:bg-orange-500 selection:text-white">
      {/* ============================================================ */}
      {/* 1. SIDEBAR ESCRITORIO (Fija a la izquierda en md/lg)          */}
      {/* ============================================================ */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-white border-r border-slate-200 shrink-0 select-none">
        {/* Header de la Sidebar con Logo */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shadow-orange-200">
            <Wrench className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Vis<span className="text-orange-600">ú</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200/60">
                Taller Pro
              </span>
            </div>
            <span className="text-[11px] text-slate-600 font-medium -mt-0.5">
              Gestión & Trazabilidad
            </span>
          </div>
        </div>

        {/* Navegación Principal Desktop */}
        <div className="flex-1 py-6 px-3 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            <div className="px-3 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
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
                        ? 'bg-orange-50 text-orange-600 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive
                            ? 'text-orange-600'
                            : 'text-slate-600 group-hover:text-slate-900'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-100 text-slate-600'
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
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Modo Terreno & Taller</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Captura fotos de inspección directamente con la cámara de tu smartphone.
            </p>
          </div>
        </div>

        {/* Footer de Sidebar */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
                AD
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-800 truncate">
                Admin Taller
              </span>
              <span className="text-[10px] text-slate-600 truncate">
                Recepción & Diagnóstico
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          {/* Logo y Nombre en Móvil */}
          <div className="flex items-center gap-2.5">
            <div className="md:hidden w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <Wrench className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base md:text-lg tracking-tight text-slate-900">
                Vis<span className="text-orange-600">ú</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200/60 hidden sm:inline-block">
                Terreno
              </span>
            </div>
          </div>

          {/* Estado de Conexión & Salida */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-slate-700 hidden sm:inline">En Línea</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 sm:hidden" />
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        <main className="flex-1 w-full max-w-5xl mx-auto p-3.5 sm:p-6 md:p-8 pb-28 md:pb-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 4. BARRA DE NAVEGACIÓN INFERIOR FIJA (BOTTOM BAR - MOBILE)  */}
      {/* ============================================================ */}
      <nav
        aria-label="Navegación móvil inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-2 flex items-center justify-around shadow-lg select-none"
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
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-orange-600 font-bold'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <div
                className={`w-10 h-7 rounded-full flex items-center justify-center transition-colors mb-0.5 ${
                  isActive ? 'bg-orange-100 text-orange-600' : 'text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{item.shortLabel}</span>
            </Link>
          );
        })}

        {/* Botón Salir en Bottom Bar */}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-slate-600 hover:text-red-600 transition-all active:scale-95"
        >
          <div className="w-10 h-7 rounded-full flex items-center justify-center mb-0.5">
            <LogOut className="w-5 h-5 text-slate-600" />
          </div>
          <span className="text-[11px] tracking-tight">Salir</span>
        </button>
      </nav>
    </div>
  );
}
