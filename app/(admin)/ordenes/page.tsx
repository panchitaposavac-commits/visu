'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Kanban,
  ClipboardPlus,
  RefreshCw,
  Search,
  User,
  Calendar,
  CheckCircle2,
  Flag,
  Car,
  ArrowRight,
} from 'lucide-react';

interface OrdenCard {
  id: number | string;
  numero_ot?: number | string;
  estado: string;
  tipo_servicio: string;
  descripcion_cliente: string;
  fecha_estimada_entrega: string;
  clientes?: {
    nombre: string;
    apellido: string;
    telefono: string;
  } | null;
  vehiculos?: {
    patente: string;
    marca: string;
    modelo: string;
  } | null;
}

const COLUMNAS_ESTADO = [
  {
    key: 'recibido',
    filter: (o: OrdenCard) => o.estado === 'recibido',
    label: 'Recibidos',
    bgBadge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  {
    key: 'en_revision',
    filter: (o: OrdenCard) => o.estado === 'en_revision',
    label: 'En Revisión / Hallazgos',
    bgBadge: 'bg-purple-100 text-purple-800',
    dot: 'bg-purple-500',
  },
  {
    key: 'esperando_aprobacion',
    filter: (o: OrdenCard) => o.estado === 'esperando_aprobacion',
    label: 'Aceptación Presupuesto',
    bgBadge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  {
    key: 'en_reparacion',
    filter: (o: OrdenCard) => ['en_reparacion', 'en_proceso'].includes(o.estado),
    label: 'En Reparación',
    bgBadge: 'bg-orange-100 text-orange-800',
    dot: 'bg-orange-500',
  },
  {
    key: 'listo_entregado',
    filter: (o: OrdenCard) => ['listo', 'entregado'].includes(o.estado),
    label: 'Listos / Entregados',
    bgBadge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
];

const ESTADO_CARD_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  recibido: { label: 'Recibido', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  en_revision: { label: 'En Revisión', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  esperando_aprobacion: { label: 'Presupuesto', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' },
  en_reparacion: { label: 'En Reparación', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  en_proceso: { label: 'En Reparación', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  listo: { label: 'Listo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  entregado: { label: 'Entregado', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
};

export default function TableroOrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const cargarOrdenes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select(`
          id,
          numero_ot,
          estado,
          tipo_servicio,
          descripcion_cliente,
          fecha_estimada_entrega,
          clientes:cliente_id (
            nombre,
            apellido,
            telefono
          ),
          vehiculos:vehiculo_id (
            patente,
            marca,
            modelo
          )
        `)
        .order('id', { ascending: false });

      if (error) {
        console.error('Error fetching ordenes:', error);
      } else if (data) {
        const formatted = (data as unknown as OrdenCard[]).map((item) => ({
          ...item,
          clientes: Array.isArray(item.clientes) ? item.clientes[0] : item.clientes,
          vehiculos: Array.isArray(item.vehiculos) ? item.vehiculos[0] : item.vehiculos,
        }));
        setOrdenes(formatted);
      }
    } catch (err) {
      console.error('Error general fetching ordenes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('ordenes_trabajo')
          .select(`
            id,
            numero_ot,
            estado,
            tipo_servicio,
            descripcion_cliente,
            fecha_estimada_entrega,
            clientes:cliente_id (
              nombre,
              apellido,
              telefono
            ),
            vehiculos:vehiculo_id (
              patente,
              marca,
              modelo
            )
          `)
          .order('id', { ascending: false });

        if (!ignore) {
          if (!error && data) {
            const formatted = (data as unknown as OrdenCard[]).map((item) => ({
              ...item,
              clientes: Array.isArray(item.clientes) ? item.clientes[0] : item.clientes,
              vehiculos: Array.isArray(item.vehiculos) ? item.vehiculos[0] : item.vehiculos,
            }));
            setOrdenes(formatted);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Error en carga inicial:', err);
          setLoading(false);
        }
      }
    }

    load();

    const handleFocus = () => {
      cargarOrdenes();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      ignore = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [cargarOrdenes]);

  // Mutación instantánea con actualización optimista de estado React y persistencia en Supabase
  const handleCambiarEstadoDirecto = async (
    e: React.MouseEvent,
    ordenId: number | string,
    nuevoEstado: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setUpdatingId(ordenId);

    // 1. Actualización optimista inmediata en la UI de React
    setOrdenes((prev) =>
      prev.map((o) => (String(o.id) === String(ordenId) ? { ...o, estado: nuevoEstado } : o))
    );

    try {
      // 2. Persistencia en Supabase
      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ estado: nuevoEstado })
        .eq('id', ordenId);

      if (error) {
        console.error('Error al actualizar estado en Supabase:', error);
        // Rollback / Refetch si la mutación falló
        cargarOrdenes();
      }
    } catch (err) {
      console.error('Error general al cambiar estado:', err);
      cargarOrdenes();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualRefresh = () => {
    setLoading(true);
    cargarOrdenes();
  };

  const filteredOrdenes = ordenes.filter((o) => {
    const term = searchTerm.toLowerCase();
    const ot = (o.numero_ot !== undefined && o.numero_ot !== null) ? String(o.numero_ot).toLowerCase() : '';
    const patente = o.vehiculos?.patente?.toLowerCase() || '';
    const cliente = `${o.clientes?.nombre || ''} ${o.clientes?.apellido || ''}`.toLowerCase();
    return ot.includes(term) || patente.includes(term) || cliente.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Kanban className="w-6 h-6 text-orange-600" />
            <span>Tablero de Órdenes de Trabajo</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Seguimiento en tiempo real del ciclo operativo de cada vehículo en taller.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Refrescar tablero"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/recepcion"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all shadow-sm shadow-orange-200"
          >
            <ClipboardPlus className="w-4 h-4" />
            <span>Nueva Recepción</span>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por OT, Patente o Cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 self-end sm:self-auto">
          <span>Total órdenes activas:</span>
          <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
            {filteredOrdenes.length}
          </span>
        </div>
      </div>

      {/* Grid de Columnas Kanban (5 Columnas Oficiales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start">
        {COLUMNAS_ESTADO.map((col) => {
          const itemsInCol = filteredOrdenes.filter(col.filter);

          return (
            <div
              key={col.key}
              className="bg-slate-100/70 border border-slate-200/80 rounded-2xl p-3 min-h-[480px] flex flex-col"
            >
              {/* Header Columna */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                <span className="font-extrabold text-xs text-slate-800 tracking-tight">
                  {col.label}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.bgBadge}`}>
                  {itemsInCol.length}
                </span>
              </div>

              {/* Lista de Órdenes */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {itemsInCol.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-300/80 rounded-xl">
                    <p className="text-[11px] text-slate-500">No hay órdenes en este estado</p>
                  </div>
                ) : (
                  itemsInCol.map((ot) => {
                    const badgeInfo =
                      ESTADO_CARD_BADGES[ot.estado || 'recibido'] ||
                      ESTADO_CARD_BADGES.recibido;

                    const isUpdatingThis = updatingId === ot.id;

                    return (
                      <Link
                        key={ot.id}
                        href={`/ordenes/${ot.id}`}
                        className="group block bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all duration-200 space-y-2.5 active:scale-[0.99] cursor-pointer"
                      >
                        {/* Cabecera Tarjeta: Folio OT y Badge de Estado */}
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900 group-hover:text-orange-600 transition-colors">
                            {ot.numero_ot !== undefined && ot.numero_ot !== null
                              ? (String(ot.numero_ot).startsWith('OT') ? ot.numero_ot : `OT #${ot.numero_ot}`)
                              : `OT #${ot.id}`}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeInfo.bg} ${badgeInfo.text} ${badgeInfo.border}`}>
                            {badgeInfo.label}
                          </span>
                        </div>

                        {/* Patente y Vehículo */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded tracking-wide font-mono">
                            {ot.vehiculos?.patente || 'S/P'}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {ot.vehiculos ? `${ot.vehiculos.marca} ${ot.vehiculos.modelo}` : 'Vehículo'}
                          </span>
                        </div>

                        {/* Cliente */}
                        {ot.clientes && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 truncate">
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">
                              {ot.clientes.nombre} {ot.clientes.apellido}
                            </span>
                          </div>
                        )}

                        {/* Descripción breve / Síntomas */}
                        <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                          {ot.descripcion_cliente}
                        </p>

                        {/* Botones de Acción Rápida por Estado (Aprobación, Reparación, Listo y Entregado) */}
                        {!['recibido', 'en_revision'].includes(ot.estado) && (
                          <div className="pt-1">
                            {ot.estado === 'esperando_aprobacion' && (
                              <button
                                type="button"
                                disabled={isUpdatingThis}
                                onClick={(e) => handleCambiarEstadoDirecto(e, ot.id, 'en_reparacion')}
                                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="Aprobar presupuesto e iniciar reparación"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprobar Presupuesto ✓</span>
                              </button>
                            )}

                            {(ot.estado === 'en_reparacion' || ot.estado === 'en_proceso') && (
                              <button
                                type="button"
                                disabled={isUpdatingThis}
                                onClick={(e) => handleCambiarEstadoDirecto(e, ot.id, 'listo')}
                                className="w-full py-1.5 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="Marcar trabajo completado y listo para entrega"
                              >
                                <Flag className="w-3.5 h-3.5" />
                                <span>Marcar Listo 🏁</span>
                              </button>
                            )}

                            {ot.estado === 'listo' && (
                              <button
                                type="button"
                                disabled={isUpdatingThis}
                                onClick={(e) => handleCambiarEstadoDirecto(e, ot.id, 'entregado')}
                                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                title="Registrar entrega del vehículo al cliente"
                              >
                                <Car className="w-3.5 h-3.5" />
                                <span>Entregar 🚗</span>
                              </button>
                            )}

                            {ot.estado === 'entregado' && (
                              <div className="w-full py-1 px-2 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[10px] flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Vehículo Entregado</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer Tarjeta: Fecha de Entrega & Ver Detalle */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                          {ot.fecha_estimada_entrega ? (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3 h-3 text-orange-600" />
                              <span>
                                {new Date(ot.fecha_estimada_entrega).toLocaleDateString('es-CL', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin fecha</span>
                          )}

                          <span className="inline-flex items-center gap-0.5 font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform">
                            <span>Ver Detalle</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
