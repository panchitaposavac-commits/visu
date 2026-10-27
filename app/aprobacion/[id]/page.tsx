'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Wrench,
  User,
  Car,
  Printer,
  RefreshCw,
  AlertCircle,
  FileText,
  Camera,
  Maximize2,
  X,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowRight,
  Check,
  XCircle,
  Phone,
} from 'lucide-react';
import { type EstadoOrden } from '@/types/visu';

// =========================================================================
// INTERFACES DE DATOS (CLIENTE FINAL)
// =========================================================================
interface ClienteDetalle {
  id?: number | string;
  nombre?: string;
  apellido?: string;
  rut_dni?: string;
  correo?: string;
  telefono?: string;
}

interface VehiculoDetalle {
  id?: number | string;
  patente?: string;
  marca?: string;
  modelo?: string;
  anio?: number | string;
  kilometraje?: number | string;
  color?: string;
}

interface HallazgoDetalle {
  id: number | string;
  orden_trabajo_id?: number | string;
  titulo: string;
  descripcion: string;
  url_foto?: string | null;
  url_archivo?: string | null;
  valor_neto?: number;
}

interface OrdenDetalle {
  id: number | string;
  numero_ot?: number | string;
  estado: EstadoOrden | string;
  tipo_servicio: string;
  descripcion_cliente?: string;
  fecha_estimada_entrega?: string;
  creado_el?: string;
  created_at?: string;
  clientes?: ClienteDetalle | ClienteDetalle[] | null;
  vehiculos?: VehiculoDetalle | VehiculoDetalle[] | null;
}

// Configuración visual de badges de estado
const ESTADO_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  recibido: {
    label: 'Vehículo Recibido',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  en_revision: {
    label: 'En Revisión / Cambios Solicitados',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  esperando_aprobacion: {
    label: 'Pendiente de tu Aprobación',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  en_reparacion: {
    label: 'Presupuesto Aprobado - En Reparación',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  en_proceso: {
    label: 'Presupuesto Aprobado - En Reparación',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  listo: {
    label: 'Trabajo Terminado - Listo para Retiro',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  entregado: {
    label: 'Vehículo Entregado',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  },
  cancelado: {
    label: 'Cotización Cancelada',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
};

// =========================================================================
// HELPERS DE FORMATEO
// =========================================================================
function formatearFechaHora(fechaStr?: string | null): string {
  if (!fechaStr) return 'Por confirmar';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return (
      d.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' hrs'
    );
  } catch {
    return fechaStr;
  }
}

function formatearFechaLarga(fechaStr?: string | null): string {
  if (!fechaStr) return 'No registrada';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return (
      d.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' hrs'
    );
  } catch {
    return fechaStr;
  }
}

function formatearPesos(val?: number | string | null): string {
  if (val === null || val === undefined || val === '') return '$ 0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '$ 0';
  return `$ ${num.toLocaleString('es-CL')}`;
}

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function AprobacionPublicaPresupuestoPage(props: PageProps) {
  const routeParams = useParams();
  const unwrappedParams = props?.params
    ? typeof (props.params as Promise<{ id: string }>).then === 'function'
      ? use(props.params as Promise<{ id: string }>)
      : (props.params as { id: string })
    : null;
  const rawId = (unwrappedParams?.id || routeParams?.id) as string;

  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [hallazgos, setHallazgos] = useState<HallazgoDetalle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de la transacción de aprobación
  const [updating, setUpdating] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<'aprobado' | 'cambios' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Modal Lightbox para fotos
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchDetallePresupuesto = useCallback(async () => {
    if (!rawId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Consultar Orden de Trabajo con Cliente y Vehículo
      let query = supabase
        .from('ordenes_trabajo')
        .select(`
          *,
          clientes:cliente_id (
            id,
            nombre,
            apellido,
            rut_dni,
            correo,
            telefono
          ),
          vehiculos:vehiculo_id (
            id,
            patente,
            marca,
            modelo,
            anio,
            kilometraje,
            color
          )
        `);

      const numericId = Number(rawId);
      if (!isNaN(numericId)) {
        query = query.or(`id.eq.${numericId},numero_ot.eq.${numericId}`);
      } else {
        query = query.eq('id', rawId);
      }

      const { data: ordenData, error: ordenErr } = await query.maybeSingle();

      if (ordenErr) {
        console.error('Error consultando orden para aprobación:', ordenErr);
        setErrorMsg('No fue posible cargar el presupuesto en este momento.');
        setLoading(false);
        return;
      }

      if (!ordenData) {
        setErrorMsg('El presupuesto solicitado no existe o no se encuentra disponible.');
        setLoading(false);
        return;
      }

      const clienteObj = Array.isArray(ordenData.clientes)
        ? ordenData.clientes[0] || null
        : ordenData.clientes;

      const vehiculoObj = Array.isArray(ordenData.vehiculos)
        ? ordenData.vehiculos[0] || null
        : ordenData.vehiculos;

      const ordenFormateada: OrdenDetalle = {
        ...ordenData,
        clientes: clienteObj,
        vehiculos: vehiculoObj,
      };

      setOrden(ordenFormateada);

      // Si la orden ya está en estado en_reparacion, reflejar éxito previo
      if (ordenData.estado === 'en_reparacion' || ordenData.estado === 'en_proceso') {
        setActionSuccess('aprobado');
      } else if (ordenData.estado === 'en_revision') {
        setActionSuccess('cambios');
      }

      const actualOrdenId = ordenData.id;

      // 2. Consultar Hallazgos Técnicos y Presupuestos
      const { data: hallazgosData, error: hallazgosErr } = await supabase
        .from('hallazgos_ot')
        .select('*')
        .eq('orden_trabajo_id', actualOrdenId)
        .order('id', { ascending: true });

      if (hallazgosErr) {
        console.error('Error consultando hallazgos:', hallazgosErr);
      } else if (hallazgosData) {
        setHallazgos(hallazgosData);
      }
    } catch (err: unknown) {
      console.error('Error no controlado cargando presupuesto:', err);
      setErrorMsg('Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchDetallePresupuesto();
  }, [fetchDetallePresupuesto]);

  // =========================================================================
  // TRANSACCIÓN SUPABASE: APROBACIÓN O SOLICITUD DE CAMBIOS
  // =========================================================================
  const handleAprobarPresupuesto = async () => {
    if (!orden?.id || updating) return;

    try {
      setUpdating(true);
      setFeedbackMsg(null);

      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ estado: 'en_reparacion' })
        .eq('id', orden.id);

      if (error) {
        console.error('Error al aprobar presupuesto en Supabase:', error);
        throw error;
      }

      setOrden((prev) => (prev ? { ...prev, estado: 'en_reparacion' } : null));
      setActionSuccess('aprobado');
      setFeedbackMsg('¡Presupuesto Aprobado con Éxito! El taller ha sido notificado.');

      // Scroll suave a la cabecera
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      console.error('Error en transacción de aprobación:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      alert(`No fue posible procesar la aprobación: ${msg}. Por favor intenta nuevamente.`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSolicitarCambios = async () => {
    if (!orden?.id || updating) return;

    const confirmar = window.confirm(
      '¿Deseas solicitar cambios o rechazar este presupuesto? Tu orden pasará a revisión con el equipo técnico de Visú.'
    );
    if (!confirmar) return;

    try {
      setUpdating(true);
      setFeedbackMsg(null);

      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ estado: 'en_revision' })
        .eq('id', orden.id);

      if (error) {
        console.error('Error al actualizar estado a revisión:', error);
        throw error;
      }

      setOrden((prev) => (prev ? { ...prev, estado: 'en_revision' } : null));
      setActionSuccess('cambios');
      setFeedbackMsg('Solicitud enviada: Tu orden está en revisión técnica.');

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      console.error('Error en transacción de revisión:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      alert(`No fue posible enviar la solicitud: ${msg}`);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Normalización de datos
  const cliente = orden?.clientes as ClienteDetalle | null;
  const vehiculo = orden?.vehiculos as VehiculoDetalle | null;

  const nombreCliente = cliente
    ? `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Estimado(a) Cliente'
    : 'Estimado(a) Cliente';
  const rutCliente = cliente?.rut_dni || 'No registrado';
  const telefonoCliente = cliente?.telefono || 'No registrado';

  const marcaModelo = vehiculo
    ? `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || 'Vehículo'
    : 'Vehículo';
  const patente = vehiculo?.patente?.toUpperCase() || 'S/P';
  const anio = vehiculo?.anio ? String(vehiculo.anio) : 'S/I';
  const color = vehiculo?.color || 'S/I';
  const kilometraje = vehiculo?.kilometraje
    ? `${Number(vehiculo.kilometraje).toLocaleString('es-CL')} km`
    : 'S/I';

  const numeroOT =
    orden?.numero_ot !== undefined && orden?.numero_ot !== null
      ? String(orden.numero_ot).startsWith('OT')
        ? orden.numero_ot
        : `OT #${orden.numero_ot}`
      : `OT #${rawId}`;

  const estadoKey = orden?.estado || 'esperando_aprobacion';
  const estadoInfo = ESTADO_CONFIG[estadoKey] || {
    label: estadoKey,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  };

  const fechaCreacion = formatearFechaLarga(orden?.creado_el || orden?.created_at);
  const fechaEstimadaEntrega = formatearFechaHora(orden?.fecha_estimada_entrega);

  // Cálculos de presupuesto
  const subtotalNeto = hallazgos.reduce(
    (acc, curr) => acc + (Number(curr.valor_neto) || 0),
    0
  );
  const iva19 = Math.round(subtotalNeto * 0.19);
  const totalGeneral = subtotalNeto + iva19;

  // Teléfono de contacto de soporte / taller
  const mensajeContactoWhatsApp = `Hola taller Visú, escribo respecto a la aprobación de presupuesto de mi vehículo *${marcaModelo}* (Patente: *${patente}*), Orden *${numeroOT}*.`;
  const whatsappContactoUrl = `https://wa.me/?text=${encodeURIComponent(mensajeContactoWhatsApp)}`;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 antialiased font-sans pb-16 print:bg-white print:p-0 print:pb-0">
      {/* ============================================================ */}
      {/* 1. ENCABEZADO SUPERIOR PÚBLICO (STICKY - SIN NAVEGACIÓN ADMIN) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs print:static print:border-b-2 print:border-slate-900 print:p-0 print:mb-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo Visú */}
          <div className="flex items-center gap-3">
            <div className="relative w-28 h-8 sm:w-32 sm:h-9">
              <Image
                src="/visu-logo.png"
                alt="Visú Taller Mecánico"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden sm:block pl-3 border-l border-slate-200 text-[11px] text-slate-600 font-medium">
              Portal de Aprobación de Presupuesto
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-2">
            <div className="bg-visu-blue text-white px-3 py-1 rounded-lg text-right shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-widest text-visu-mint block leading-tight">
                Folio
              </span>
              <span className="text-xs sm:text-sm font-black tracking-tight">{numeroOT}</span>
            </div>

            <button
              onClick={handlePrint}
              disabled={loading || !!errorMsg}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold print:hidden"
              title="Imprimir o Guardar en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. CONTENIDO PRINCIPAL FLUIDO Y RESPONSIVO                   */}
      {/* ============================================================ */}
      <main className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-5 space-y-5">
        {/* ============================================================ */}
        {/* ESTADOS DE CARGA Y ERROR                                    */}
        {/* ============================================================ */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm animate-pulse">
            <div className="w-12 h-12 bg-visu-mint/20 rounded-full mx-auto flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-visu-blue animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Cargando cotización y detalle del presupuesto técnico...
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-bold text-base text-red-900">Presupuesto no disponible</h3>
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VISTA DEL PRESUPUESTO CUANDO ESTÁ CARGADO                   */}
        {/* ============================================================ */}
        {!loading && orden && (
          <>
            {/* Banner de Estado / Confirmación de Éxito */}
            {(actionSuccess === 'aprobado' ||
              estadoKey === 'en_reparacion' ||
              estadoKey === 'en_proceso') && (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2 animate-fade-in print:bg-emerald-50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-extrabold text-sm sm:text-base text-emerald-950">
                      ¡Presupuesto Aprobado con Éxito!
                    </h2>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      Tu confirmación fue registrada en el sistema. Los técnicos de Visú han sido
                      notificados y comenzarán los trabajos de reparación en tu vehículo según lo
                      cotizado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(actionSuccess === 'cambios' || estadoKey === 'en_revision') && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-extrabold text-sm sm:text-base text-purple-950">
                      Solicitud de Revisión / Cambios Registrada
                    </h2>
                    <p className="text-xs text-purple-800 mt-0.5 leading-relaxed">
                      Tu solicitud de revisión ha sido notificada al equipo de taller. Un asesor se
                      contactará contigo para resolver inquietudes o ajustar el presupuesto.
                    </p>
                    <div className="pt-2">
                      <a
                        href={whatsappContactoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Escribir al taller por WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cabecera Informativa de la Cotización */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-visu-blue bg-visu-mint/20 border border-visu-mint/40 px-2 py-0.5 rounded inline-block mb-1.5">
                    Cotización Formal de Taller
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Presupuesto Técnico de Reparación
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Preparado especialmente para <strong className="text-slate-800">{nombreCliente}</strong> • Emitido el {fechaCreacion}
                  </p>
                </div>

                <div className="self-start sm:self-auto">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${estadoInfo.bg} ${estadoInfo.text} ${estadoInfo.border}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${estadoInfo.dot}`}></span>
                    {estadoInfo.label}
                  </span>
                </div>
              </div>

              {/* Ficha Resumida del Vehículo y Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Vehículo */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-slate-600 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-visu-blue" />
                      Vehículo en Reparación
                    </span>
                    <span className="bg-white border border-slate-300 font-mono font-black text-xs px-2 py-0.5 rounded shadow-2xs text-slate-900 tracking-wider">
                      {patente}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      {marcaModelo}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Año: {anio} • Color: {color} • Kilometraje: {kilometraje}
                    </p>
                  </div>
                </div>

                {/* Cliente & Entrega */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <span className="text-[10px] uppercase font-extrabold text-slate-600 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-visu-blue" />
                    Datos del Propietario
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                      {nombreCliente}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      RUT: <strong className="text-slate-800 font-mono">{rutCliente}</strong> • Tel: {telefonoCliente}
                    </p>
                  </div>
                  {fechaEstimadaEntrega !== 'Por confirmar' && (
                    <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Estimación de Entrega: <strong className="text-slate-800">{fechaEstimadaEntrega}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* 3. RESUMEN DE HALLAZGOS Y TRABAJOS COTIZADOS                 */}
            {/* ============================================================ */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-visu-mint/20 text-visu-blue flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm sm:text-base text-slate-900">
                      Detalle de Trabajos y Hallazgos Técnicos
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      Revisión efectuada en elevador por el equipo mecánico
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {hallazgos.length} {hallazgos.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>

              {hallazgos.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-xs text-slate-600">
                    No se han registrado ítems valorizados en este presupuesto aún.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hallazgos.map((item, idx) => {
                    const fotoSrc = item.url_foto || item.url_archivo;
                    const valorNeto = Number(item.valor_neto) || 0;

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Número correlativo */}
                          <span className="w-6 h-6 rounded-lg bg-visu-mint/25 text-visu-blue font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>

                          {/* Foto miniatura con zoom */}
                          {fotoSrc && (
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(fotoSrc)}
                              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0 group cursor-pointer focus:outline-none"
                              title="Toca para ampliar foto de evidencia"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={fotoSrc}
                                alt={item.titulo || `Evidencia ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          )}

                          {/* Descripción Técnica */}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug">
                              {item.titulo || `Trabajo / Hallazgo #${idx + 1}`}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                              {item.descripcion || 'Sin descripción detallada ingresada.'}
                            </p>
                          </div>
                        </div>

                        {/* Valor Neto del Ítem */}
                        <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/80 flex sm:flex-col justify-between items-center sm:items-end">
                          <span className="text-[10px] uppercase font-bold text-slate-600 block">
                            Valor Neto
                          </span>
                          <span className="font-mono font-black text-sm sm:text-base text-slate-900">
                            {formatearPesos(valorNeto)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ============================================================ */}
              {/* LIQUIDACIÓN DE TOTALES (NETO, IVA 19%, TOTAL)                */}
              {/* ============================================================ */}
              <div className="pt-2 border-t border-slate-200">
                <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-visu-mint flex items-center gap-1.5">
                      <Calculator className="w-4 h-4" />
                      Resumen Económico
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Valores en Pesos Chilenos (CLP)
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Subtotal Neto ({hallazgos.length} ítems):</span>
                      <span className="font-mono font-bold text-white">
                        {formatearPesos(subtotalNeto)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span>IVA (19%):</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatearPesos(iva19)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                      <div>
                        <span className="font-black text-sm sm:text-base text-white block">
                          Total General:
                        </span>
                        <span className="text-[10px] text-visu-mint font-semibold">
                          IVA incluido • Precio final a pagar
                        </span>
                      </div>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-visu-mint tracking-tight">
                        {formatearPesos(totalGeneral)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* 4. BOTONES RESPONSIVOS DE ACCIÓN / APROBACIÓN                */}
            {/* ============================================================ */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 print:hidden">
              <div>
                <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-visu-blue" />
                  Resolución del Cliente
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Revisa con atención los trabajos y cotización detallados arriba. Selecciona una
                  de las opciones para autorizar o solicitar modificaciones al taller.
                </p>
              </div>

              {/* Botones Responsivos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Botón 1: Aprobar Presupuesto */}
                <button
                  type="button"
                  onClick={handleAprobarPresupuesto}
                  disabled={updating || estadoKey === 'en_reparacion' || estadoKey === 'en_proceso'}
                  className={`w-full py-4 px-5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] ${
                    estadoKey === 'en_reparacion' || estadoKey === 'en_proceso'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  {updating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Procesando confirmación...</span>
                    </>
                  ) : estadoKey === 'en_reparacion' || estadoKey === 'en_proceso' ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-700" />
                      <span>✓ Presupuesto ya Aprobado</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Aprobar Presupuesto</span>
                    </>
                  )}
                </button>

                {/* Botón 2: Solicitar Cambios / Rechazar */}
                <button
                  type="button"
                  onClick={handleSolicitarCambios}
                  disabled={updating || estadoKey === 'en_revision'}
                  className={`w-full py-4 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] ${
                    estadoKey === 'en_revision'
                      ? 'bg-purple-100 text-purple-800 border border-purple-300 cursor-not-allowed'
                      : 'bg-white hover:bg-rose-50/80 border-2 border-rose-300 text-rose-700 hover:border-rose-400'
                  }`}
                >
                  {estadoKey === 'en_revision' ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>En Revisión con el Taller</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Solicitar Cambios / Rechazar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Botón de Contacto Auxiliar por WhatsApp */}
              <div className="pt-2 text-center">
                <a
                  href={whatsappContactoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>¿Tienes dudas sobre los trabajos? Habla directamente con un asesor</span>
                </a>
              </div>
            </div>

            {/* Términos y Garantía */}
            <div className="text-[11px] text-slate-600 leading-relaxed bg-slate-100/70 rounded-xl p-4 border border-slate-200">
              <p className="font-semibold text-slate-800 mb-1">
                Garantía y Condiciones del Servicio Visú:
              </p>
              <p>
                Todos los trabajos y repuestos cotizados cuentan con garantía oficial del taller.
                Cualquier trabajo adicional imprevisto derivado del desarme requerirá una nueva
                autorización expresa antes de su ejecución.
              </p>
            </div>
          </>
        )}
      </main>

      {/* ============================================================ */}
      {/* 5. MODAL LIGHTBOX PARA VISUALIZAR FOTOS                      */}
      {/* ============================================================ */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:hidden"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 bg-slate-950/80 text-white border-b border-slate-800">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-visu-mint" />
                Evidencia Técnica de Taller
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Cerrar vista previa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative flex-1 min-h-[300px] max-h-[75vh] flex items-center justify-center p-2 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto}
                alt="Evidencia fotográfica en alta resolución"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
