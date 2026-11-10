'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Plus,
  Camera,
  Clock,
  CheckCircle2,
  Car,
  User,
  Phone,
  ExternalLink,
  Search,
  Wrench,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface ClienteData {
  id?: string | number;
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

interface VehiculoData {
  id?: string | number;
  patente: string;
  marca?: string;
  modelo?: string;
  anio?: number | string;
  color?: string;
}

interface OrdenItem {
  id: string;
  numero_ot?: number | string;
  estado: string;
  tipo_servicio: string;
  descripcion_cliente?: string;
  fecha_estimada_entrega?: string;
  creado_el: string;
  clientes: ClienteData | null;
  vehiculos: VehiculoData | null;
  totalPresupuesto: number;
  totalFotos: number;
}

function getEstadoBadge(estado: string): { label: string; badge: string; dot: string } {
  switch (estado) {
    case 'esperando_aprobacion':
      return {
        label: 'Presupuesto por Aprobar',
        badge: 'bg-amber-50 text-amber-800 border-amber-300',
        dot: 'bg-amber-500',
      };
    case 'en_reparacion':
    case 'en_proceso':
      return {
        label: 'En Reparación',
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        dot: 'bg-blue-600',
      };
    case 'listo':
      return {
        label: 'Listo para Entrega',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-600',
      };
    case 'entregado':
      return {
        label: 'Entregado al Cliente',
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400',
      };
    case 'en_revision':
      return {
        label: 'En Diagnóstico',
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
        dot: 'bg-purple-600',
      };
    case 'recibido':
      return {
        label: 'Vehículo Ingresado',
        badge: 'bg-sky-50 text-sky-800 border-sky-200',
        dot: 'bg-sky-500',
      };
    case 'cancelado':
      return {
        label: 'Cancelado',
        badge: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
      };
    default:
      return {
        label: estado || 'Registrado',
        badge: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

function formatearPesos(val?: number | null): string {
  if (!val || isNaN(val)) return '$ 0';
  return `$ ${Math.round(val).toLocaleString('es-CL')}`;
}

function formatFechaCorta(fechaIso?: string): string {
  if (!fechaIso) return '';
  try {
    const d = new Date(fechaIso);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' hrs';
  } catch {
    return '';
  }
}

function formatearTelefonoChileno(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('569') && digits.length === 11) return digits;
  if (digits.startsWith('9') && digits.length === 9) return `56${digits}`;
  if (digits.length === 8) return `569${digits}`;
  if (digits.length >= 8) return digits;
  return null;
}

export default function DashboardInicioPage() {
  const [ordenes, setOrdenes] = useState<OrdenItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'por_aprobar' | 'en_taller' | 'listos'>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getOrigin = (): string => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  };

  useEffect(() => {
    let ignore = false;

    async function cargarDatos() {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Consultar órdenes con clientes y vehículos relacionados
        const { data: ordenesData, error: ordenesError } = await supabase
          .from('ordenes_trabajo')
          .select(`
            id,
            numero_ot,
            estado,
            tipo_servicio,
            descripcion_cliente,
            fecha_estimada_entrega,
            creado_el,
            clientes:cliente_id (
              id,
              nombre,
              apellido,
              telefono
            ),
            vehiculos:vehiculo_id (
              id,
              patente,
              marca,
              modelo,
              anio,
              color
            )
          `)
          .order('creado_el', { ascending: false });

        if (ignore) return;

        if (ordenesError) {
          console.error('Error al cargar órdenes:', ordenesError);
          setErrorMsg('No fue posible cargar el listado de vehículos.');
          return;
        }

        // 2. Consultar hallazgos para cálculo de presupuesto
        const { data: hallazgosData } = await supabase
          .from('hallazgos_ot')
          .select('orden_trabajo_id, valor_neto, precio_neto');

        if (ignore) return;

        // 3. Consultar evidencias para conteo de fotos de respaldo
        const { data: evidenciasData } = await supabase
          .from('evidencias_orden')
          .select('orden_trabajo_id');

        if (ignore) return;

        // Mapeo en memoria de montos por orden
        const presupuestosMap: Record<string, number> = {};
        if (hallazgosData) {
          for (const h of hallazgosData) {
            const otId = String(h.orden_trabajo_id);
            const monto = Number(h.valor_neto || h.precio_neto || 0);
            presupuestosMap[otId] = (presupuestosMap[otId] || 0) + monto;
          }
        }

        // Mapeo en memoria de fotos por orden
        const fotosMap: Record<string, number> = {};
        if (evidenciasData) {
          for (const ev of evidenciasData) {
            const otId = String(ev.orden_trabajo_id);
            fotosMap[otId] = (fotosMap[otId] || 0) + 1;
          }
        }

        if (ordenesData) {
          const items: OrdenItem[] = (ordenesData as unknown as Array<{
            id: string | number;
            numero_ot?: number | string;
            estado: string;
            tipo_servicio: string;
            descripcion_cliente?: string;
            fecha_estimada_entrega?: string;
            creado_el: string;
            clientes: ClienteData | ClienteData[] | null;
            vehiculos: VehiculoData | VehiculoData[] | null;
          }>).map((item) => {
            const idStr = String(item.id);
            const clienteObj = Array.isArray(item.clientes) ? item.clientes[0] || null : item.clientes;
            const vehiculoObj = Array.isArray(item.vehiculos) ? item.vehiculos[0] || null : item.vehiculos;

            return {
              id: idStr,
              numero_ot: item.numero_ot,
              estado: item.estado,
              tipo_servicio: item.tipo_servicio,
              descripcion_cliente: item.descripcion_cliente,
              fecha_estimada_entrega: item.fecha_estimada_entrega,
              creado_el: item.creado_el,
              clientes: clienteObj,
              vehiculos: vehiculoObj,
              totalPresupuesto: presupuestosMap[idStr] || 0,
              totalFotos: fotosMap[idStr] || 0,
            };
          });

          setOrdenes(items);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Error general cargando dashboard:', err);
          setErrorMsg('Ocurrió un error inesperado al conectar con el servidor.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    cargarDatos();

    return () => {
      ignore = true;
    };
  }, []);

  // Métricas reales y operativas basadas exclusivamente en los registros actuales
  const metricas = useMemo(() => {
    let porAprobarCount = 0;
    let porAprobarMonto = 0;
    let enReparacionCount = 0;
    let listosCount = 0;

    for (const o of ordenes) {
      if (o.estado === 'esperando_aprobacion') {
        porAprobarCount++;
        porAprobarMonto += o.totalPresupuesto;
      } else if (['en_reparacion', 'en_proceso', 'en_revision', 'recibido'].includes(o.estado)) {
        enReparacionCount++;
      } else if (o.estado === 'listo') {
        listosCount++;
      }
    }

    return {
      porAprobarCount,
      porAprobarMonto,
      enReparacionCount,
      listosCount,
    };
  }, [ordenes]);

  // Filtrado reactivo por término de búsqueda y pestaña activa
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((item) => {
      // Filtro de pestaña
      if (filtroEstado === 'por_aprobar' && item.estado !== 'esperando_aprobacion') {
        return false;
      }
      if (filtroEstado === 'en_taller' && !['en_reparacion', 'en_proceso', 'en_revision', 'recibido'].includes(item.estado)) {
        return false;
      }
      if (filtroEstado === 'listos' && !['listo', 'entregado'].includes(item.estado)) {
        return false;
      }

      // Filtro de texto (patente, marca, modelo, cliente)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const patente = item.vehiculos?.patente?.toLowerCase() || '';
      const marca = item.vehiculos?.marca?.toLowerCase() || '';
      const modelo = item.vehiculos?.modelo?.toLowerCase() || '';
      const cliente = `${item.clientes?.nombre || ''} ${item.clientes?.apellido || ''}`.toLowerCase();

      return patente.includes(term) || marca.includes(term) || modelo.includes(term) || cliente.includes(term);
    });
  }, [ordenes, filtroEstado, searchTerm]);

  // Acción para copiar el enlace público al portapapeles
  const handleCopyLink = (item: OrdenItem) => {
    const isAprobacion = item.estado === 'esperando_aprobacion';
    const originUrl = getOrigin();
    const link = `${originUrl}${isAprobacion ? '/aprobacion/' : '/informe/'}${item.id}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Generación del enlace dinámico a WhatsApp Web / Móvil
  const getWhatsAppHref = (item: OrdenItem): string | null => {
    const phone = formatearTelefonoChileno(item.clientes?.telefono);
    if (!phone) return null;

    const clienteNombre = item.clientes?.nombre || 'Estimado/a cliente';
    const vehiculoDesc = item.vehiculos
      ? `${item.vehiculos.marca || ''} ${item.vehiculos.modelo || ''} (${item.vehiculos.patente})`.trim()
      : 'su vehículo';

    const isAprobacion = item.estado === 'esperando_aprobacion';
    const originUrl = getOrigin();
    const url = `${originUrl}${isAprobacion ? '/aprobacion/' : '/informe/'}${item.id}`;

    let texto = '';
    if (isAprobacion) {
      texto = `Hola ${clienteNombre}, te comparto el presupuesto y diagnóstico visual de tu ${vehiculoDesc}: ${url}\n\nPuedes revisar las fotos y aprobar los trabajos directamente en el enlace. Quedamos atentos en el taller.`;
    } else if (item.estado === 'listo' || item.estado === 'entregado') {
      texto = `Hola ${clienteNombre}, tu ${vehiculoDesc} está listo para retiro en el taller.\n\nPuedes revisar el informe con las fotos del trabajo realizado aquí: ${url}`;
    } else {
      texto = `Hola ${clienteNombre}, te comparto el informe visual de avance de tu ${vehiculoDesc} en el taller: ${url}`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3.5 sm:space-y-6 antialiased py-2 sm:py-4 px-2 sm:px-4">
      {/* ========================================================================= */}
      {/* 1. HEADER: Mensaje de valor y acción principal                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-6 shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tus clientes, siempre informados.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 max-w-xl">
            Documenta cada trabajo y comparte con tus clientes lo que ocurre con su vehículo.
          </p>
        </div>

        {/* Botón de acción principal */}
        <Link
          href="/recepcion"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D63ED] hover:bg-blue-700 active:scale-[0.98] transition-all rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0 cursor-pointer"
        >
          <Camera className="w-4 h-4 text-white" />
          <span>Nueva recepción con fotos</span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* 2. RADAR OPERATIVO MÓVIL: 3 indicadores compactos en 1 fila (sm:hidden)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {/* Indicador 1: Presupuestos por aprobar */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'por_aprobar' ? 'todos' : 'por_aprobar')}
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center active:scale-[0.98] ${
            filtroEstado === 'por_aprobar'
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
              : 'bg-amber-50/80 border-amber-200/90 hover:bg-amber-100/60'
          }`}
        >
          <span className="text-xl font-black text-amber-800 leading-none">
            {metricas.porAprobarCount}
          </span>
          <span className="text-[11px] font-bold text-amber-700 truncate w-full mt-1">
            Por aprobar
          </span>
        </button>

        {/* Indicador 2: En reparación */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'en_taller' ? 'todos' : 'en_taller')}
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center active:scale-[0.98] ${
            filtroEstado === 'en_taller'
              ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400/50 shadow-xs'
              : 'bg-blue-50/80 border-blue-200/90 hover:bg-blue-100/60'
          }`}
        >
          <span className="text-xl font-black text-blue-800 leading-none">
            {metricas.enReparacionCount}
          </span>
          <span className="text-[11px] font-bold text-blue-700 truncate w-full mt-1">
            En reparación
          </span>
        </button>

        {/* Indicador 3: Listos para entrega */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'listos' ? 'todos' : 'listos')}
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center active:scale-[0.98] ${
            filtroEstado === 'listos'
              ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xs'
              : 'bg-emerald-50/80 border-emerald-200/90 hover:bg-emerald-100/60'
          }`}
        >
          <span className="text-xl font-black text-emerald-800 leading-none">
            {metricas.listosCount}
          </span>
          <span className="text-[11px] font-bold text-emerald-700 truncate w-full mt-1">
            Listos
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2b. RADAR OPERATIVO ESCRITORIO: Tarjetas KPI completas (hidden sm:grid)    */}
      {/* ========================================================================= */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3.5">
        {/* Tarjeta 1: Presupuestos pendientes */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'por_aprobar' ? 'todos' : 'por_aprobar')}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstado === 'por_aprobar'
              ? 'bg-amber-50/80 border-amber-300 shadow-xs ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Presupuestos pendientes
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {metricas.porAprobarCount}
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {metricas.porAprobarCount === 1
              ? '1 presupuesto esperando respuesta'
              : `${metricas.porAprobarCount} presupuestos esperando respuesta`}
          </p>
        </button>

        {/* Tarjeta 2: En Reparación */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'en_taller' ? 'todos' : 'en_taller')}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstado === 'en_taller'
              ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-blue-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              En Reparación
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {metricas.enReparacionCount}
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {metricas.enReparacionCount === 1
              ? '1 trabajo activo en taller'
              : `${metricas.enReparacionCount} trabajos activos en taller`}
          </p>
        </button>

        {/* Tarjeta 3: Listos para Entrega */}
        <button
          type="button"
          onClick={() => setFiltroEstado(filtroEstado === 'listos' ? 'todos' : 'listos')}
          className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstado === 'listos'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-xs ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Listos para Entrega
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {metricas.listosCount}
          </div>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {metricas.listosCount === 1
              ? '1 auto con informe listo'
              : `${metricas.listosCount} autos con informe listo`}
          </p>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE HERRAMIENTAS: Búsqueda y Pestañas de Filtrado               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5 sm:pt-2">
        {/* Pestañas de estado rápido (escritorio) */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'todos'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({ordenes.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('por_aprobar')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'por_aprobar'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pendientes ({metricas.porAprobarCount})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('en_taller')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'en_taller'
                ? 'bg-white text-blue-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            En Reparación ({metricas.enReparacionCount})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('listos')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filtroEstado === 'listos'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Listos ({metricas.listosCount})
          </button>
        </div>

        {/* Input de búsqueda por patente o cliente y botón limpiar en móvil */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar patente o cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* En móvil: Acceso rápido para mostrar todos si hay un filtro activo */}
          {filtroEstado !== 'todos' && (
            <button
              type="button"
              onClick={() => setFiltroEstado('todos')}
              className="sm:hidden px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shrink-0 shadow-2xs cursor-pointer"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BANDEJA DE VEHÍCULOS Y SEGUIMIENTO                                    */}
      {/* ========================================================================= */}
      <div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-5 bg-slate-200 rounded w-28" />
                    <div className="h-3.5 bg-slate-100 rounded w-40" />
                  </div>
                </div>
                <div className="h-8 bg-slate-100 rounded-xl w-36" />
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-sm">{errorMsg}</p>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center shadow-2xs">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              {searchTerm ? 'No se encontraron vehículos' : 'No hay vehículos en este estado'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {searchTerm
                ? `No existen coincidencias para "${searchTerm}". Intenta buscar por otra patente o nombre.`
                : 'Registra un nuevo ingreso para generar fotografías, diagnósticos y compartir el informe.'}
            </p>
            <div className="mt-5">
              <Link
                href="/recepcion"
                className="inline-flex items-center gap-2 bg-[#1D63ED] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl px-4 py-2.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Nuevo Ingreso</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {ordenesFiltradas.map((item) => {
              const patente = item.vehiculos?.patente || 'S/P';
              const vehiculoDesc = item.vehiculos
                ? `${item.vehiculos.marca || ''} ${item.vehiculos.modelo || ''} ${item.vehiculos.anio ? `(${item.vehiculos.anio})` : ''}`.trim()
                : 'Vehículo sin detalles';
              const clienteNombre = item.clientes
                ? `${item.clientes.nombre || ''} ${item.clientes.apellido || ''}`.trim()
                : 'Cliente no registrado';
              const telefono = item.clientes?.telefono;
              const estadoBadge = getEstadoBadge(item.estado);
              const fechaStr = formatFechaCorta(item.creado_el);
              const waHref = getWhatsAppHref(item);
              const isAprobacion = item.estado === 'esperando_aprobacion';
              const publicLink = isAprobacion ? `/aprobacion/${item.id}` : `/informe/${item.id}`;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Sección Izquierda: Patente, Vehículo y Cliente */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      {/* Chapa Patente Chilena Estilizada */}
                      <div className="shrink-0">
                        <div className="border-2 border-slate-900 bg-white rounded-lg px-2.5 py-1.5 shadow-xs text-center min-w-[92px]">
                          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase block -mb-0.5">
                            CHILE
                          </span>
                          <span className="font-extrabold text-base sm:text-lg text-slate-950 tracking-wider font-mono">
                            {patente}
                          </span>
                        </div>
                      </div>

                      {/* Información de vehículo y cliente */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-slate-900 truncate">
                            {vehiculoDesc}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${estadoBadge.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${estadoBadge.dot}`}></span>
                            {estadoBadge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {clienteNombre}
                          </span>

                          {telefono && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {telefono}
                              </span>
                            </>
                          )}

                          {fechaStr && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">{fechaStr}</span>
                            </>
                          )}
                        </div>

                        {/* Badges de soporte: Fotos de evidencia y Presupuesto */}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          {item.totalFotos > 0 && (
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                              <Camera className="w-3.5 h-3.5 text-slate-500" />
                              <span>{item.totalFotos} evidencias</span>
                            </span>
                          )}

                          {item.totalPresupuesto > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                                isAprobacion
                                  ? 'bg-amber-100/70 text-amber-900 font-bold'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span>Presupuesto: {formatearPesos(item.totalPresupuesto)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sección Derecha: Acciones Rápidas de Comunicación y Gestión */}
                    <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0 flex-wrap">
                      {/* 1. Compartir por WhatsApp */}
                      {waHref ? (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl px-3 py-2 transition-all shadow-xs active:scale-[0.98]"
                          title="Compartir informe con el cliente vía WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item)}
                          className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 transition-all cursor-pointer"
                          title="Copiar enlace para el cliente"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copiar Enlace</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* 2. Ver como Cliente */}
                      <a
                        href={publicLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 transition-all"
                        title="Abrir la misma pantalla que ve el cliente"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ver como Cliente</span>
                      </a>

                      {/* 3. Gestionar Orden Interna */}
                      <Link
                        href={`/ordenes/${item.id}`}
                        className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl px-3.5 py-2 transition-all shadow-xs"
                        title="Abrir detalle interno del taller"
                      >
                        <span>Gestionar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
