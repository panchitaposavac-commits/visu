'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  Car,
} from 'lucide-react';

interface VehiculoRel {
  patente: string;
  marca?: string;
  modelo?: string;
}

interface RecienteItem {
  id: string;
  numero_ot: number;
  estado: string;
  tipo_servicio: string;
  creado_el: string;
  vehiculos: VehiculoRel | null;
}

interface DashboardMetrics {
  enviados: number;
  aprobados: number;
  conversion: number;
}

function getEstadoInfo(estado: string): { label: string; badge: string } {
  switch (estado) {
    case 'recibido':
      return { label: 'Recibido', badge: 'bg-blue-50 text-blue-700 border-blue-200/70' };
    case 'en_revision':
      return { label: 'En revisión', badge: 'bg-amber-50 text-amber-700 border-amber-200/70' };
    case 'esperando_aprobacion':
      return { label: 'Esperando', badge: 'bg-purple-50 text-purple-700 border-purple-200/70' };
    case 'en_proceso':
      return { label: 'En proceso', badge: 'bg-sky-50 text-sky-700 border-sky-200/70' };
    case 'en_reparacion':
      return { label: 'En reparación', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/70' };
    case 'listo':
      return { label: 'Listo', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' };
    case 'entregado':
      return { label: 'Completado', badge: 'bg-blue-50 text-blue-700 border-blue-200/70' };
    case 'cancelado':
      return { label: 'Cancelado', badge: 'bg-red-50 text-red-700 border-red-200/70' };
    default:
      return { label: estado || 'Pendiente', badge: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

function formatFecha(fechaIso?: string): string {
  if (!fechaIso) return '';
  try {
    const d = new Date(fechaIso);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export default function DashboardInicioPage() {
  const [recientes, setRecientes] = useState<RecienteItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    enviados: 0,
    aprobados: 0,
    conversion: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  const cargarDashboard = useCallback(async () => {
    try {
      // 1. Obtener los últimos 5 registros de ordenes_trabajo con vehículos
      const { data: ordenesData, error: ordenesError } = await supabase
        .from('ordenes_trabajo')
        .select(`
          id,
          numero_ot,
          estado,
          tipo_servicio,
          creado_el,
          vehiculos:vehiculo_id (
            patente,
            marca,
            modelo
          )
        `)
        .order('creado_el', { ascending: false })
        .limit(5);

      if (ordenesError) {
        console.error('Error al cargar órdenes recientes:', ordenesError);
      } else if (ordenesData) {
        const formatted: RecienteItem[] = (ordenesData as unknown as Array<{
          id: string;
          numero_ot: number;
          estado: string;
          tipo_servicio: string;
          creado_el: string;
          vehiculos: VehiculoRel | VehiculoRel[] | null;
        }>).map((item) => ({
          id: item.id,
          numero_ot: item.numero_ot,
          estado: item.estado,
          tipo_servicio: item.tipo_servicio,
          creado_el: item.creado_el,
          vehiculos: Array.isArray(item.vehiculos) ? item.vehiculos[0] : item.vehiculos,
        }));
        setRecientes(formatted);
      }

      // 2. Obtener métricas de órdenes
      const { data: allData, error: allError } = await supabase
        .from('ordenes_trabajo')
        .select('id, estado');

      if (!allError && allData) {
        const total = allData.length;
        const aprobadosCount = allData.filter((o) =>
          ['en_proceso', 'en_reparacion', 'listo', 'entregado'].includes(o.estado)
        ).length;
        const convRate = total > 0 ? Math.round((aprobadosCount / total) * 100) : 0;

        setMetrics({
          enviados: total,
          aprobados: aprobadosCount,
          conversion: convRate,
        });
      }
    } catch (err) {
      console.error('Error general cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 sm:space-y-6 antialiased">
      {/* Saludo y Encabezado Mobile-First */}
      <div className="pt-1 sm:pt-2">
        <p className="text-sm font-medium text-slate-500">Hola, Tamara</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Diagnósticos
        </h1>
      </div>

      {/* Botón Primario Ancho Completo (Touch-friendly para móvil) */}
      <div>
        <Link
          href="/recepcion"
          className="group block w-full bg-[#1D63ED] hover:bg-blue-700 active:scale-[0.99] transition-all rounded-2xl p-5 sm:p-6 text-white shadow-lg shadow-blue-500/20"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-lg sm:text-xl font-bold tracking-tight block">
                Nuevo Ingreso
              </span>
              <span className="text-xs sm:text-sm text-blue-100 font-normal mt-0.5 block">
                Captura, presupuesta y envía
              </span>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center shrink-0 transition-colors">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
        </Link>
      </div>

      {/* Grid de Métricas: grid-cols-3 gap-2 */}
      <div className="grid grid-cols-3 gap-2">
        {/* Tarjeta 1: Enviados */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {metrics.enviados}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Enviados</p>
          </div>
        </div>

        {/* Tarjeta 2: Aprobados */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-2">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {metrics.aprobados}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Aprobados</p>
          </div>
        </div>

        {/* Tarjeta 3: Conversión */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 mb-2">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {metrics.conversion}%
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Conversión</p>
          </div>
        </div>
      </div>

      {/* Lista de Recientes conectada a Supabase */}
      <div className="pt-2 sm:pt-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">Recientes</h2>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-slate-100 rounded-xl" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-20" />
                    <div className="h-3 bg-slate-100 rounded w-12" />
                  </div>
                </div>
                <div className="h-6 bg-slate-100 rounded-full w-20" />
              </div>
            ))}
          </div>
        ) : recientes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <Car className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No hay registros recientes</p>
            <p className="text-xs text-slate-500 mt-1">
              Crea tu primer diagnóstico para visualizarlo aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recientes.map((item) => {
              const patente = item.vehiculos?.patente || 'S/P';
              const estadoInfo = getEstadoInfo(item.estado);
              const fechaStr = formatFecha(item.creado_el);

              return (
                <Link
                  key={item.id}
                  href={`/ordenes/${item.id}`}
                  className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-base sm:text-lg text-slate-900 uppercase tracking-wide block">
                        {patente}
                      </span>
                      {fechaStr && (
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {fechaStr}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full border ${estadoInfo.badge}`}
                  >
                    {estadoInfo.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
