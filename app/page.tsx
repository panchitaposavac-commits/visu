import Link from 'next/link';
import { Wrench, ClipboardPlus, Kanban, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 antialiased">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Logo & Marca */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <Wrench className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Vis<span className="text-orange-600">ú</span>
              </h1>
              <span className="text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-700 px-2.5 py-1 rounded-md border border-orange-200">
                Taller Pro
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              Digitalización y Trazabilidad Integral de Talleres Mecánicos
            </p>
          </div>
        </div>

        {/* Tarjeta de Acceso */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-slate-700">Sistema Conectado & Operativo</span>
            </div>
            <span className="text-xs text-slate-600">v1.0 Producción</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opción 1: Recepción de Vehículo */}
            <Link
              href="/recepcion"
              className="group p-5 rounded-xl border-2 border-orange-500 bg-orange-50/40 hover:bg-orange-50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-slate-900 mb-1">
                  Recepción de Vehículo
                </h2>
                <p className="text-xs text-slate-600">
                  Wizard en 4 pasos con respaldo fotográfico de 5 áreas y generación de OT.
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-orange-600 mt-4">
                <span>Iniciar Recepción</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Opción 2: Tablero de Órdenes */}
            <Link
              href="/ordenes"
              className="group p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Kanban className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-slate-900 mb-1">
                  Tablero de Órdenes
                </h2>
                <p className="text-xs text-slate-600">
                  Monitoreo Kanban de estados, diagnósticos y entregas acordadas.
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-700 mt-4">
                <span>Ver Tablero</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-slate-600">
              Desarrollado con Next.js App Router, TypeScript, Tailwind CSS y Supabase.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}