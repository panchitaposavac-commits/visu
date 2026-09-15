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
  { key: 'recibido', label: 'Recibidos', bgBadge: 'bg-blue-100 text-blue-800' },
  { key: 'en_diagnostico', label: 'En Diagnóstico', bgBadge: 'bg-amber-100 text-amber-800' },
  { key: 'en_reparacion', label: 'En Reparación', bgBadge: 'bg-purple-100 text-purple-800' },
  { key: 'listo_entrega', label: 'Listo para Entrega', bgBadge: 'bg-emerald-100 text-emerald-800' },
];

export default function TableroOrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchOrdenes = useCallback(async () => {
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

    return () => {
      ignore = true;
    };
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    fetchOrdenes();
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
            Seguimiento en tiempo real de todas las unidades en taller.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs"
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
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 self-end sm:self-auto">
          <span>Total órdenes activas:</span>
          <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
            {filteredOrdenes.length}
          </span>
        </div>
      </div>

      {/* Grid de Columnas Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUMNAS_ESTADO.map((col) => {
          const itemsInCol = filteredOrdenes.filter(
            (o) => (o.estado || 'recibido') === col.key
          );

          return (
            <div
              key={col.key}
              className="bg-slate-100/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 min-h-[450px] flex flex-col"
            >
              {/* Header Columna */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-800">{col.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bgBadge}`}>
                  {itemsInCol.length}
                </span>
              </div>

              {/* Lista de Órdenes */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {itemsInCol.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300/80 rounded-xl">
                    <p className="text-xs text-slate-600">No hay órdenes en este estado</p>
                  </div>
                ) : (
                  itemsInCol.map((ot) => (
                    <div
                      key={ot.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5"
                    >
                      {/* Cabecera Tarjeta */}
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          {ot.numero_ot !== undefined && ot.numero_ot !== null
                            ? (String(ot.numero_ot).startsWith('OT') ? ot.numero_ot : `OT #${ot.numero_ot}`)
                            : `OT #${ot.id}`}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                          {ot.tipo_servicio}
                        </span>
                      </div>

                      {/* Patente y Vehículo */}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded tracking-wide">
                          {ot.vehiculos?.patente || 'S/P'}
                        </span>
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {ot.vehiculos ? `${ot.vehiculos.marca} ${ot.vehiculos.modelo}` : 'Vehículo'}
                        </span>
                      </div>

                      {/* Cliente */}
                      {ot.clientes && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                          <User className="w-3.5 h-3.5 text-slate-600" />
                          <span className="truncate">
                            {ot.clientes.nombre} {ot.clientes.apellido}
                          </span>
                        </div>
                      )}

                      {/* Descripción breve */}
                      <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                        {ot.descripcion_cliente}
                      </p>

                      {/* Fecha de entrega */}
                      {ot.fecha_estimada_entrega && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          <Calendar className="w-3 h-3 text-orange-600" />
                          <span>
                            Entrega:{' '}
                            <strong>
                              {new Date(ot.fecha_estimada_entrega).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
