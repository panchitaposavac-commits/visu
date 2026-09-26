'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Wrench,
  User,
  Car,
  ArrowLeft,
  Printer,
  RefreshCw,
  AlertCircle,
  FileText,
  Camera,
  Maximize2,
  X,
  PlusCircle,
  Calculator,
  CheckCircle2,
} from 'lucide-react';
import {
  TIPO_SERVICIO_LABELS,
  type TipoServicio,
  type EstadoOrden,
} from '@/types/visu';

// =========================================================================
// INTERFACES ESTRICTAS DE DATOS
// =========================================================================
interface ClienteDetalle {
  id?: number | string;
  nombre?: string;
  apellido?: string;
  rut_dni?: string;
  rut?: string;
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

interface EvidenciaDetalle {
  id: number | string;
  orden_trabajo_id?: number | string;
  etapa?: string;
  seccion?: string;
  descripcion?: string;
  url_archivo: string;
  creado_el?: string;
  created_at?: string;
}

interface HallazgoDetalle {
  id: number | string;
  orden_trabajo_id?: number | string;
  titulo: string;
  descripcion: string;
  url_foto?: string | null;
  url_archivo?: string | null;
  valor_neto?: number;
  creado_el?: string;
  created_at?: string;
}

interface OrdenDetalle {
  id: number | string;
  numero_ot?: number | string;
  estado: EstadoOrden | string;
  tipo_servicio: TipoServicio | string;
  descripcion_cliente: string;
  fecha_estimada_entrega?: string;
  creado_el?: string;
  created_at?: string;
  cliente_id?: number | string;
  vehiculo_id?: number | string;
  clientes?: ClienteDetalle | ClienteDetalle[] | null;
  vehiculos?: VehiculoDetalle | VehiculoDetalle[] | null;
}

// Configuración de estilos para badges de estado
const ESTADO_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  recibido: {
    label: 'Recibido',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  en_revision: {
    label: 'En Revisión - Hallazgos',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  esperando_aprobacion: {
    label: 'Aceptación Presupuesto',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  en_reparacion: {
    label: 'En Reparación',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  en_proceso: {
    label: 'En Reparación',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  listo: {
    label: 'Listo para Entrega',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  entregado: {
    label: 'Entregado',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  },
  cancelado: {
    label: 'Cancelado',
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
  if (!fechaStr) return 'No registrada';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' hrs';
  } catch {
    return fechaStr;
  }
}

function formatearFechaLarga(fechaStr?: string | null): string {
  if (!fechaStr) return 'No registrada';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' hrs';
  } catch {
    return fechaStr;
  }
}

function formatearKilometraje(val?: number | string | null): string {
  if (val === null || val === undefined || val === '') return 'No registrado';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return String(val);
  return `${num.toLocaleString('es-CL')} km`;
}

function formatearPesos(val?: number | string | null): string {
  if (val === null || val === undefined || val === '') return '$ 0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '$ 0';
  return `$ ${Math.round(num).toLocaleString('es-CL')}`;
}

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function DetalleOrdenPage(props: PageProps) {
  // Soporte universal para params en Next.js App Router
  const routeParams = useParams();
  const unwrappedParams = props?.params
    ? typeof (props.params as Promise<{ id: string }>).then === 'function'
      ? use(props.params as Promise<{ id: string }>)
      : (props.params as { id: string })
    : null;
  const rawId = (unwrappedParams?.id || routeParams?.id) as string;

  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [evidencias, setEvidencias] = useState<EvidenciaDetalle[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoDetalle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleCambiarEstado = async (nuevoEstado: EstadoOrden) => {
    if (!orden?.id) return;
    try {
      setTransitioning(true);
      const { error } = await supabase
        .from('ordenes_trabajo')
        .update({ estado: nuevoEstado })
        .eq('id', orden.id);

      if (error) throw error;

      setOrden((prev) => (prev ? { ...prev, estado: nuevoEstado } : null));
      setStatusFeedback(`Estado de OT actualizado a: ${ESTADO_CONFIG[nuevoEstado]?.label || nuevoEstado}`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: unknown) {
      console.error('Error al actualizar estado:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      alert(`No se pudo cambiar el estado: ${msg}`);
    } finally {
      setTransitioning(false);
    }
  };

  const handleIrAHallazgos = async () => {
    try {
      // Si la orden está en estado 'recibido', transicionar a 'en_revision'
      if (orden && orden.estado === 'recibido') {
        const { error } = await supabase
          .from('ordenes_trabajo')
          .update({ estado: 'en_revision' })
          .eq('id', orden.id);

        if (error) {
          console.error('Error detallado de Supabase al actualizar estado:', error);
          alert('Error al actualizar estado en Supabase: ' + error.message);
          return;
        }

        setOrden((prev) => (prev ? { ...prev, estado: 'en_revision' } : null));
      }
      const targetId = orden?.id || rawId;
      router.push(`/ordenes/${targetId}/ejecutar`);
    } catch (err) {
      console.error('Error inesperado:', err);
      const targetId = orden?.id || rawId;
      router.push(`/ordenes/${targetId}/ejecutar`);
    }
  };

  const handleIniciarHallazgos = handleIrAHallazgos;

  const fetchDetalleOrden = useCallback(async () => {
    if (!rawId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Consultar Orden de Trabajo con Clientes y Vehículos relacionados
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
        console.error('Error al consultar orden:', ordenErr);
        setErrorMsg(`Error al consultar la orden: ${ordenErr.message}`);
        setLoading(false);
        return;
      }

      if (!ordenData) {
        setErrorMsg(`No se encontró ninguna orden de trabajo con el identificador "${rawId}".`);
        setLoading(false);
        return;
      }

      // Normalizar relaciones cuando Supabase devuelve arrays o un solo objeto
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

      const actualOrdenId = ordenData.id;

      // 2. Consultar Evidencias Fotográficas de la etapa 'recepcion'
      const { data: evidenciasData, error: evidenciasErr } = await supabase
        .from('evidencias_orden')
        .select('*')
        .eq('orden_trabajo_id', actualOrdenId)
        .order('id', { ascending: true });

      if (evidenciasErr) {
        console.warn('Aviso: No se pudieron cargar las evidencias:', evidenciasErr);
      } else if (evidenciasData) {
        const fotosRecepcion = evidenciasData.filter(
          (ev: EvidenciaDetalle) => !ev.etapa || ev.etapa.toLowerCase() === 'recepcion'
        );
        setEvidencias(fotosRecepcion.length > 0 ? fotosRecepcion : evidenciasData);
      }

      // 3. Consultar Hallazgos de Taller y Presupuesto
      const { data: hallazgosData, error: hallazgosErr } = await supabase
        .from('hallazgos_ot')
        .select('*')
        .eq('orden_trabajo_id', actualOrdenId)
        .order('id', { ascending: true });

      if (!hallazgosErr && hallazgosData) {
        setHallazgos(hallazgosData);
      }
    } catch (err: unknown) {
      console.error('Error no controlado cargando orden:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMsg(`Error inesperado al cargar la orden: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!rawId) return;

      try {
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

        if (ignore) return;

        if (ordenErr) {
          console.error('Error al consultar orden:', ordenErr);
          setErrorMsg(`Error al consultar la orden: ${ordenErr.message}`);
          setLoading(false);
          return;
        }

        if (!ordenData) {
          setErrorMsg(`No se encontró ninguna orden de trabajo con el identificador "${rawId}".`);
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

        const actualOrdenId = ordenData.id;

        // Cargar evidencias de recepción
        const { data: evidenciasData, error: evidenciasErr } = await supabase
          .from('evidencias_orden')
          .select('*')
          .eq('orden_trabajo_id', actualOrdenId)
          .order('id', { ascending: true });

        if (ignore) return;

        if (evidenciasErr) {
          console.warn('Aviso: No se pudieron cargar las evidencias:', evidenciasErr);
        } else if (evidenciasData) {
          const fotosRecepcion = evidenciasData.filter(
            (ev: EvidenciaDetalle) => !ev.etapa || ev.etapa.toLowerCase() === 'recepcion'
          );
          setEvidencias(fotosRecepcion.length > 0 ? fotosRecepcion : evidenciasData);
        }

        // Cargar hallazgos de taller
        const { data: hallazgosData, error: hallazgosErr } = await supabase
          .from('hallazgos_ot')
          .select('*')
          .eq('orden_trabajo_id', actualOrdenId)
          .order('id', { ascending: true });

        if (ignore) return;

        if (!hallazgosErr && hallazgosData) {
          setHallazgos(hallazgosData);
        }
      } catch (err: unknown) {
        if (ignore) return;
        console.error('Error no controlado cargando orden:', err);
        const msg = err instanceof Error ? err.message : 'Error inesperado';
        setErrorMsg(`Error inesperado al cargar la orden: ${msg}`);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [rawId]);

  const handlePrint = () => {
    window.print();
  };

  // Normalizar datos del cliente
  const cliente = orden?.clientes as ClienteDetalle | null;
  const nombreCliente = cliente
    ? `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Cliente No Registrado'
    : 'Cliente No Registrado';
  const rutCliente = cliente?.rut_dni || cliente?.rut || 'Sin RUT registrado';
  const telefonoCliente = cliente?.telefono || 'Sin teléfono';
  const correoCliente = cliente?.correo || 'Sin correo registrado';

  // Normalizar datos del vehículo
  const vehiculo = orden?.vehiculos as VehiculoDetalle | null;
  const patente = vehiculo?.patente?.toUpperCase() || 'S/P';
  const marcaModelo = vehiculo
    ? `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || 'Vehículo sin especificar'
    : 'Vehículo sin especificar';
  const anioVehiculo = vehiculo?.anio ? String(vehiculo.anio) : 'N/D';
  const kmVehiculo = formatearKilometraje(vehiculo?.kilometraje);
  const colorVehiculo = vehiculo?.color || 'No especificado';

  // Normalizar datos de la OT
  const numeroOT =
    orden?.numero_ot !== undefined && orden?.numero_ot !== null
      ? String(orden.numero_ot).startsWith('OT')
        ? orden.numero_ot
        : `OT #${orden.numero_ot}`
      : orden?.id
      ? `OT #${orden.id}`
      : 'OT #---';

  const estadoKey = (orden?.estado || 'recibido').toLowerCase();
  const estadoInfo =
    ESTADO_CONFIG[estadoKey] || {
      label: orden?.estado || 'Recibido',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-400',
    };

  const tipoServicioLabel =
    TIPO_SERVICIO_LABELS[orden?.tipo_servicio as TipoServicio] ||
    orden?.tipo_servicio ||
    'Servicio General';

  const fechaCreacion = formatearFechaLarga(orden?.creado_el || orden?.created_at);
  const fechaEstimadaEntrega = formatearFechaHora(orden?.fecha_estimada_entrega);

  // Parsear texto del diagnóstico si viene con viñetas
  const lineasDiagnostico = (orden?.descripcion_cliente || 'Sin descripción o diagnóstico ingresado.')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Cálculos de presupuesto
  const subtotalNeto = hallazgos.reduce(
    (acc, curr) => acc + (Number(curr.valor_neto) || 0),
    0
  );
  const iva19 = Math.round(subtotalNeto * 0.19);
  const totalGeneral = subtotalNeto + iva19;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none print:space-y-0">
      {/* ============================================================ */}
      {/* BARRA DE ACCIONES SUPERIOR (PANTALLA - OCULTA AL IMPRIMIR)   */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/ordenes"
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver al Tablero</span>
          </Link>

          <div className="h-6 w-px bg-slate-200"></div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {numeroOT}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${estadoInfo.bg} ${estadoInfo.text} ${estadoInfo.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${estadoInfo.dot}`}></span>
                {estadoInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-600 hidden sm:block">
              Informe oficial y presupuesto valorizado de taller
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {/* Botones de Acción Condicionales según Estado */}
          {estadoKey === 'recibido' && (
            <button
              type="button"
              onClick={handleIniciarHallazgos}
              className="bg-orange-600 hover:bg-orange-700 active:scale-98 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-sm shadow-orange-200 cursor-pointer print:hidden"
            >
              <Wrench className="w-4 h-4" />
              <span>🔧 Iniciar Revisión / Hallazgos</span>
            </button>
          )}

          {estadoKey === 'en_revision' && (
            <Link
              href={`/ordenes/${rawId}/ejecutar?paso=2`}
              className="bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-sm shadow-purple-200 print:hidden"
            >
              <span>💰 Continuar a Presupuesto</span>
            </Link>
          )}

          {estadoKey === 'esperando_aprobacion' && (
            <button
              type="button"
              onClick={() => handleCambiarEstado('en_reparacion')}
              disabled={transitioning}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 print:hidden"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ Presupuesto Aceptado por Cliente</span>
            </button>
          )}

          {(estadoKey === 'en_reparacion' || estadoKey === 'en_proceso') && (
            <button
              type="button"
              onClick={() => handleCambiarEstado('listo')}
              disabled={transitioning}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 print:hidden"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ Marcar Trabajo Completado</span>
            </button>
          )}

          {estadoKey === 'listo' && (
            <button
              type="button"
              onClick={() => handleCambiarEstado('entregado')}
              disabled={transitioning}
              className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 print:hidden"
            >
              <span>🚗 Entregar Vehículo al Cliente</span>
            </button>
          )}

          <button
            onClick={() => fetchDetalleOrden()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || !!errorMsg}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar / Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Feedback de Transición de Estado */}
      {statusFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 shadow-2xs animate-fade-in print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{statusFeedback}</span>
        </div>
      )}

      {/* Banner de Presupuesto Esperando Aprobación */}
      {estadoKey === 'esperando_aprobacion' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-amber-950">
                Presupuesto Pendiente de Aprobación
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Total Cotizado:{' '}
                <strong className="font-mono font-bold text-slate-900">
                  {formatearPesos(totalGeneral)}
                </strong>{' '}
                (IVA 19% incluido). Confirma la conformidad del cliente para iniciar la reparación.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Link
              href={`/ordenes/${rawId}/ejecutar`}
              className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100/60 transition-colors"
            >
              Editar Cotización
            </Link>
            <button
              type="button"
              onClick={() => handleCambiarEstado('en_reparacion')}
              disabled={transitioning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ Presupuesto Aceptado por Cliente</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ESTADO DE CARGA (SKELETON EN PANTALLA)                       */}
      {/* ============================================================ */}
      {loading && !orden && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm animate-pulse print:hidden">
          <div className="w-12 h-12 bg-orange-100 rounded-full mx-auto flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-orange-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Cargando informe y ficha técnica de la Orden de Trabajo...
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* ESTADO DE ERROR                                              */}
      {/* ============================================================ */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm print:hidden">
          <div className="w-12 h-12 bg-red-100 rounded-full mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-base text-red-900">No se pudo cargar la orden</h3>
            <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
          </div>
          <Link
            href="/ordenes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Regresar al Tablero de Órdenes</span>
          </Link>
        </div>
      )}

      {/* ============================================================ */}
      {/* DOCUMENTO FORMAL DE RECEPCIÓN (TIPO HOJA A4 / IMPRIMIBLE)    */}
      {/* ============================================================ */}
      {orden && (
        <div
          id="informe-recepcion"
          className="bg-white p-6 sm:p-8 md:p-10 max-w-4xl mx-auto rounded-2xl border border-slate-200/90 shadow-sm print:p-0 print:max-w-none print:shadow-none print:border-none print:rounded-none space-y-6 print:space-y-4 print:text-black"
        >
          {/* ------------------------------------------------------------ */}
          {/* CABECERA INSTITUCIONAL                                       */}
          {/* ------------------------------------------------------------ */}
          <div className="border-b-2 border-slate-900 pb-5 print:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Logo y Nombre Institucional */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shrink-0 print:bg-orange-600 print:text-white">
                <Wrench className="w-6 h-6 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-slate-900">
                    Vis<span className="text-orange-600">ú</span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                    Taller Mecánico
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase mt-0.5">
                  Informe Oficial de Recepción, Hallazgos y Presupuesto
                </p>
              </div>
            </div>

            {/* Folio y Metadatos de Cabecera */}
            <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <div className="bg-slate-900 text-white px-3.5 py-1 rounded-lg text-right shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-widest text-orange-400 block">
                  Folio Orden
                </span>
                <span className="text-base font-black tracking-tight">{numeroOT}</span>
              </div>
              <div className="text-right mt-1.5">
                <span className="text-[11px] text-slate-600 font-medium block">
                  Ingreso: <strong className="text-slate-900">{fechaCreacion}</strong>
                </span>
                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${estadoInfo.bg} ${estadoInfo.text} ${estadoInfo.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${estadoInfo.dot}`}></span>
                    Estado: {estadoInfo.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 1 Y 2: DATOS DEL CLIENTE Y FICHA TÉCNICA (2 COLUMNAS) */}
          {/* ------------------------------------------------------------ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
            {/* BLOQUE 1: DATOS DEL CLIENTE */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 print:p-3 print:bg-white print:border-slate-300 space-y-3 print-avoid-break">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  1. Datos del Cliente
                </h2>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                    Nombre Completo
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">{nombreCliente}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                      RUT / DNI
                    </span>
                    <p className="font-semibold text-slate-800 font-mono">{rutCliente}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                      Teléfono
                    </span>
                    <p className="font-semibold text-slate-800">{telefonoCliente}</p>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                    Correo Electrónico
                  </span>
                  <p className="font-medium text-slate-700 break-all">{correoCliente}</p>
                </div>
              </div>
            </div>

            {/* BLOQUE 2: FICHA TÉCNICA DEL VEHÍCULO */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 print:p-3 print:bg-white print:border-slate-300 space-y-3 print-avoid-break">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                    <Car className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    2. Ficha del Vehículo
                  </h2>
                </div>

                {/* Badge Patente Estilo Placa */}
                <div className="inline-flex items-center bg-white border-2 border-slate-900 text-slate-900 rounded-md px-2.5 py-0.5 shadow-2xs font-mono font-black text-xs tracking-widest">
                  <span className="text-[9px] text-blue-700 mr-1.5 font-sans font-bold">CL</span>
                  {patente}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                    Marca y Modelo
                  </span>
                  <p className="font-extrabold text-sm text-slate-900">{marcaModelo}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                      Año
                    </span>
                    <p className="font-semibold text-slate-800">{anioVehiculo}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                      Kilometraje
                    </span>
                    <p className="font-extrabold text-orange-700 font-mono">{kmVehiculo}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold block">
                      Color
                    </span>
                    <p className="font-semibold text-slate-800 capitalize">{colorVehiculo}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 3: MOTIVO DE INGRESO Y DIAGNÓSTICO INICIAL            */}
          {/* ------------------------------------------------------------ */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 print:p-3 print:border-slate-300 space-y-3 print-avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  3. Motivo de Ingreso y Diagnóstico Preliminar
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                  Tipo: {tipoServicioLabel}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  Entrega Estimada: <strong>{fechaEstimadaEntrega}</strong>
                </span>
              </div>
            </div>

            {/* Cuadro con texto estructurado del diagnóstico */}
            <div className="bg-slate-50/90 rounded-lg p-3.5 border border-slate-200/80 text-xs text-slate-800 leading-relaxed space-y-1.5 print:bg-slate-50 print:border-slate-300">
              {lineasDiagnostico.map((linea, idx) => {
                const esBullet = linea.startsWith('•') || linea.startsWith('-');
                return (
                  <p
                    key={idx}
                    className={`${
                      esBullet
                        ? 'font-medium pl-1 text-slate-800'
                        : 'font-normal text-slate-700'
                    }`}
                  >
                    {linea}
                  </p>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 4: REGISTRO FOTOGRÁFICO DE RECEPCIÓN (5 ÁREAS)        */}
          {/* ------------------------------------------------------------ */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 print:p-3 print:border-slate-300 space-y-3 print-avoid-break">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  4. Registro Fotográfico de Recepción ({evidencias.length} Fotos)
                </h2>
              </div>
              <span className="text-[10px] text-slate-600 font-medium hidden sm:inline">
                Inspección visual 360° al momento del ingreso
              </span>
            </div>

            {evidencias.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
                <Camera className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs text-slate-600 font-medium">
                  Sin registro fotográfico adjunto en la recepción inicial.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                {evidencias.map((ev, index) => {
                  const tagSeccion = ev.seccion || ev.descripcion || `Área ${index + 1}`;
                  return (
                    <div
                      key={ev.id || index}
                      className="group relative bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-2xs print-avoid-break"
                    >
                      {/* Imagen con Aspect Ratio */}
                      <div className="relative aspect-4/3 w-full bg-slate-200 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ev.url_archivo}
                          alt={`Evidencia ${tagSeccion}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />

                        {/* Botón de Zoom en pantalla */}
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(ev.url_archivo)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white print:hidden cursor-pointer"
                          title="Ver imagen en tamaño completo"
                        >
                          <Maximize2 className="w-5 h-5 drop-shadow-md" />
                        </button>
                      </div>

                      {/* Etiqueta de la Foto */}
                      <div className="p-1.5 bg-white border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {tagSeccion}
                        </span>
                        <span className="text-[9px] uppercase font-semibold text-slate-600 px-1 py-0.2 bg-slate-100 rounded">
                          Ingreso
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 5: HALLAZGOS Y DIAGNÓSTICO EN TALLER (ELEVADOR / IA)  */}
          {/* ------------------------------------------------------------ */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 print:p-3 print:border-slate-300 space-y-3.5 print-avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    5. Hallazgos y Diagnóstico en Taller ({hallazgos.length} Ítems)
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleIniciarHallazgos}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline print:hidden inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Editar Hallazgos en Taller</span>
                <span>→</span>
              </button>
            </div>

            {hallazgos.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50 space-y-2">
                <Wrench className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  No se han registrado hallazgos de elevador ni presupuestos en taller aún.
                </p>
                <button
                  type="button"
                  onClick={handleIniciarHallazgos}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer print:hidden"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Registrar Hallazgos</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {hallazgos.map((item, index) => {
                  const fotoUrl = item.url_foto || item.url_archivo;

                  return (
                    <div
                      key={item.id || index}
                      className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row gap-3 items-start justify-between print:bg-white print:border-slate-300 print-avoid-break"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>

                        {fotoUrl && (
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fotoUrl}
                              alt={item.titulo}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(fotoUrl)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white print:hidden cursor-pointer"
                              title="Ver foto ampliada"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                            {item.titulo}
                          </h3>
                          <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                            {item.descripcion}
                          </div>
                        </div>
                      </div>

                      {/* Valor neto de este hallazgo */}
                      <div className="self-end sm:self-center text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 w-full sm:w-auto">
                        <span className="text-[10px] uppercase font-bold text-slate-600 block">
                          Neto
                        </span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {formatearPesos(item.valor_neto)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 6: PRESUPUESTO Y LIQUIDACIÓN (SUBTOTAL, IVA, TOTAL)   */}
          {/* ------------------------------------------------------------ */}
          <div className="bg-white border-2 border-slate-900 rounded-xl p-4.5 print:p-3.5 print:border-slate-900 space-y-3 print-avoid-break">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Calculator className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                  6. Resumen Presupuestario y Liquidación
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-700">
                Moneda Nacional (CLP)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="text-[10px] text-slate-600 leading-relaxed space-y-1">
                <p>
                  * Los valores detallados corresponden a mano de obra especializada e insumos
                  descritos en los hallazgos técnicos.
                </p>
                <p>* Cotización sujeta a aprobación formal del cliente antes del desarme mayor.</p>
              </div>

              {/* Tabla de Totales */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs print:bg-slate-50">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatearPesos(subtotalNeto)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>IVA (19%):</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatearPesos(iva19)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-300 flex items-center justify-between font-black text-sm text-slate-900">
                  <span>Total General:</span>
                  <span className="font-mono text-base text-orange-700">
                    {formatearPesos(totalGeneral)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 7: ZONA DE FIRMAS Y TÉRMINOS LEGALES                  */}
          {/* ------------------------------------------------------------ */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4.5 print:p-3 print:bg-white print:border-slate-300 space-y-4 print-avoid-break">
            {/* Términos y Declaración Legal */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">
                7. Términos de Recepción, Aprobación de Presupuesto y Garantía
              </span>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                El cliente declara estar en conocimiento de los hallazgos expuestos y aprueba el
                presupuesto indicado para la ejecución de los trabajos. <strong>Visú Taller Mecánico</strong> garantiza
                la mano de obra y repuestos provistos por un periodo de 3 meses o 5.000 km, lo que
                ocurra primero. El taller no se hace responsable por objetos de valor no declarados.
              </p>
            </div>

            {/* Recuadros de Firma */}
            <div className="grid grid-cols-2 gap-6 pt-3 print:gap-4">
              {/* Firma Taller / Mecánico */}
              <div className="border border-slate-300 rounded-lg p-3 bg-white text-center flex flex-col justify-between h-28 print:h-24">
                <div className="h-10"></div>
                <div>
                  <div className="border-t border-slate-400 mx-4 pt-1">
                    <p className="text-[11px] font-bold text-slate-900">
                      Firma Recepcionista / Asesor
                    </p>
                    <p className="text-[9px] text-slate-600 font-medium">
                      Visú Taller Mecánico • Control Calidad
                    </p>
                  </div>
                </div>
              </div>

              {/* Firma Cliente */}
              <div className="border border-slate-300 rounded-lg p-3 bg-white text-center flex flex-col justify-between h-28 print:h-24">
                <div className="h-10"></div>
                <div>
                  <div className="border-t border-slate-400 mx-4 pt-1">
                    <p className="text-[11px] font-bold text-slate-900 truncate">
                      Firma y Conformidad del Cliente
                    </p>
                    <p className="text-[9px] text-slate-600 font-medium truncate">
                      {nombreCliente} • RUT: {rutCliente}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de Página del Informe */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[9px] text-slate-600">
              <span>Documento Oficial Visú Taller Mecánico • Trazabilidad & Presupuesto</span>
              <span>Página 1 de 1</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL LIGHTBOX PARA ZOOM DE FOTOS (SOLO WEB)                 */}
      {/* ============================================================ */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto}
              alt="Vista detallada de evidencia"
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
