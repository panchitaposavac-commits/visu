import Link from 'next/link';
import Image from 'next/image';
import { ClipboardPlus, Kanban, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 antialiased selection:bg-visu-mint selection:text-slate-950">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Logo Oficial & Marca */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center py-2">
            <Image
              src="/visu-logo.png"
              alt="Visú Logo"
              width={260}
              height={96}
              priority
              className="h-20 w-auto object-contain drop-shadow-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest bg-visu-mint/20 text-visu-blue px-3 py-1 rounded-full border border-visu-mint/50">
                Taller Pro
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 font-medium">
              Digitalización y Trazabilidad Integral de Talleres Mecánicos
            </p>
          </div>
        </div>

        {/* Tarjeta de Acceso */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-visu-mint animate-pulse"></div>
              <span className="text-xs font-semibold text-slate-700">Sistema Conectado & Operativo</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">v1.0 Producción</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opción 1: Recepción de Vehículo */}
            <Link
              href="/recepcion"
              className="group p-5 rounded-xl border-2 border-visu-mint bg-visu-mint/5 hover:bg-visu-mint/15 transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-visu-blue text-white group-hover:bg-visu-mint group-hover:text-slate-950 flex items-center justify-center mb-3 group-hover:scale-105 transition-all shadow-xs">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-slate-900 mb-1 group-hover:text-visu-blue transition-colors">
                  Recepción de Vehículo
                </h2>
                <p className="text-xs text-slate-600">
                  Wizard en 5 pasos con respaldo fotográfico de inspección y generación de OT.
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-visu-blue group-hover:text-slate-900 mt-4 transition-colors">
                <span>Iniciar Recepción</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-visu-mint" />
              </div>
            </Link>

            {/* Opción 2: Tablero de Órdenes */}
            <Link
              href="/ordenes"
              className="group p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-visu-blue/30 transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-visu-blue group-hover:text-white text-slate-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-all shadow-xs">
                  <Kanban className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-slate-900 mb-1 group-hover:text-visu-blue transition-colors">
                  Tablero de Órdenes
                </h2>
                <p className="text-xs text-slate-600">
                  Monitoreo Kanban de estados, diagnósticos y entregas acordadas.
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-visu-blue mt-4 transition-colors">
                <span>Ver Tablero</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-slate-500">
              Desarrollado con Next.js App Router, TypeScript, Tailwind CSS y Supabase.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}