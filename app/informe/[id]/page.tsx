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
} from 'lucide-react';
import {
  TIPO_SERVICIO_LABELS,
  type TipoServicio,
  type EstadoOrden,
} from '@/types/visu';

// =========================================================================
// INTERFACES DE DATOS (SOLO LECTURA)
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

interface EvidenciaDetalle {
  id: number | string;
  orden_trabajo_id?: number | string;
  etapa?: string;
  seccion?: string;
  descripcion?: string;
  url_archivo: string;
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
  tipo_servicio: TipoServicio | string;
  descripcion_cliente: string;
  fecha_estimada_entrega?: string;
  creado_el?: string;
  created_at?: string;
  clientes?: ClienteDetalle | ClienteDetalle[] | null;
  vehiculos?: VehiculoDetalle | VehiculoDetalle[] | null;
}

// Configuración visual de badges de estado para el cliente
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
    label: 'En Diagnóstico Inicial',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  esperando_aprobacion: {
    label: 'Presupuesto Listo para Aprobación',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  en_reparacion: {
    label: 'En Reparación',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  en_proceso: {
    label: 'En Reparación',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  listo: {
    label: 'Listo para Retiro',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  entregado: {
    label: 'Completado y Entregado',
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
  return `$ ${num.toLocaleString('es-CL')}`;
}

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function InformePublicoClientePage(props: PageProps) {
  const routeParams = useParams();
  const unwrappedParams = props?.params
    ? typeof (props.params as Promise<{ id: string }>).then === 'function'
      ? use(props.params as Promise<{ id: string }>)
      : (props.params as { id: string })
    : null;
  const rawId = (unwrappedParams?.id || routeParams?.id) as string;

  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [evidencias, setEvidencias] = useState<EvidenciaDetalle[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoDetalle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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
        setErrorMsg('No fue posible cargar el informe en este momento.');
        setLoading(false);
        return;
      }

      if (!ordenData) {
        setErrorMsg('El informe solicitado no existe o no se encuentra disponible.');
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

      // 2. Consultar Evidencias Fotográficas
      const { data: evidenciasData } = await supabase
        .from('evidencias_orden')
        .select('*')
        .eq('orden_trabajo_id', actualOrdenId)
        .order('id', { ascending: true });

      if (evidenciasData) {
        const fotosRecepcion = evidenciasData.filter(
          (ev: EvidenciaDetalle) => !ev.etapa || ev.etapa.toLowerCase() === 'recepcion'
        );
        setEvidencias(fotosRecepcion.length > 0 ? fotosRecepcion : evidenciasData);
      }

      // 3. Consultar Hallazgos Técnicos y Presupuesto
      const { data: hallazgosData } = await supabase
        .from('hallazgos_ot')
        .select('*')
        .eq('orden_trabajo_id', actualOrdenId)
        .order('id', { ascending: true });

      if (hallazgosData) {
        setHallazgos(hallazgosData);
      }
    } catch (err: unknown) {
      console.error('Error no controlado cargando informe:', err);
      setErrorMsg('Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchDetalleOrden();
  }, [fetchDetalleOrden]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Normalización de datos para la vista
  const cliente = orden?.clientes as ClienteDetalle | null;
  const vehiculo = orden?.vehiculos as VehiculoDetalle | null;

  const nombreCliente = cliente
    ? `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Cliente'
    : 'Cliente';
  const rutCliente = cliente?.rut_dni || 'No registrado';
  const telefonoCliente = cliente?.telefono || 'No registrado';
  const correoCliente = cliente?.correo || 'No registrado';

  const marcaModelo = vehiculo
    ? `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || 'Vehículo'
    : 'Vehículo';
  const patente = (vehiculo?.patente || 'S/P').toUpperCase();
  const anioVehiculo = vehiculo?.anio ? String(vehiculo.anio) : 'S/I';
  const kmVehiculo = formatearKilometraje(vehiculo?.kilometraje);
  const colorVehiculo = vehiculo?.color || 'S/I';

  const numeroOT = orden?.numero_ot
    ? `OT #${orden.numero_ot}`
    : orden?.id
    ? `OT #${orden.id}`
    : 'Orden';

  const estadoKey = (orden?.estado || 'recibido').toLowerCase();
  const estadoInfo = ESTADO_CONFIG[estadoKey] || {
    label: orden?.estado || 'En Proceso',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  };

  const tipoServicioLabel =
    TIPO_SERVICIO_LABELS[orden?.tipo_servicio as TipoServicio] ||
    orden?.tipo_servicio ||
    'Servicio General';

  const fechaCreacion = formatearFechaLarga(orden?.creado_el || orden?.created_at);
  const fechaEstimadaEntrega = formatearFechaHora(orden?.fecha_estimada_entrega);

  const lineasDiagnostico = (orden?.descripcion_cliente || 'Sin descripción o requerimiento registrado.')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const subtotalNeto = hallazgos.reduce(
    (acc, curr) => acc + (Number(curr.valor_neto) || 0),
    0
  );
  const iva19 = Math.round(subtotalNeto * 0.19);
  const totalGeneral = subtotalNeto + iva19;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 antialiased selection:bg-visu-mint selection:text-slate-950 print:bg-white print:min-h-0">
      {/* ============================================================ */}
      {/* 1. ENCABEZADO PÚBLICO FIJO / BARRA DE ACCIONES PARA CLIENTE  */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs print:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/visu-logo.png"
            alt="Visú"
            width={105}
            height={36}
            priority
            className="h-7 w-auto object-contain"
          />
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-visu-mint/20 text-visu-blue px-2 py-0.5 rounded border border-visu-mint/40">
              Informe del Cliente
            </span>
            <span className="text-xs font-bold text-slate-700">{numeroOT}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            disabled={loading || !!errorMsg}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-60"
            title="Exportar a PDF o Imprimir Comprobante"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar / Imprimir PDF</span>
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. CONTENIDO PRINCIPAL: INFORME OFICIAL VISÚ                */}
      {/* ============================================================ */}
      <main className="max-w-4xl mx-auto p-3.5 sm:p-6 md:p-8 space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-4">
        {/* Skeleton de Carga */}
        {loading && !orden && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm animate-pulse print:hidden">
            <div className="w-12 h-12 bg-visu-mint/20 rounded-full mx-auto flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-visu-blue animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Cargando informe oficial de recepción del vehículo...
            </p>
          </div>
        )}

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm print:hidden">
            <div className="w-12 h-12 bg-red-100 rounded-full mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="font-bold text-base text-red-900">Informe no disponible</h2>
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Documento Imprimible / Ficha del Informe */}
        {orden && (
          <div
            id="informe-recepcion-cliente"
            className="bg-white p-5 sm:p-8 md:p-10 rounded-2xl border border-slate-200/90 shadow-sm print:p-0 print:max-w-none print:shadow-none print:border-none print:rounded-none space-y-6 print:space-y-4 print:text-black"
          >
            {/* ---------------------------------------------------------- */}
            {/* CABECERA INSTITUCIONAL                                     */}
            {/* ---------------------------------------------------------- */}
            <div className="border-b-2 border-slate-900 pb-5 print:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <Image
                  src="/visu-logo.png"
                  alt="Visú"
                  width={140}
                  height={50}
                  priority
                  className="h-10 w-auto object-contain"
                />
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-visu-mint/20 text-visu-blue px-2 py-0.5 rounded border border-visu-mint/50">
                    Taller Mecánico
                  </span>
                  <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase mt-1">
                    Informe Oficial de Recepción y Diagnóstico
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <div className="bg-visu-blue text-white px-3.5 py-1 rounded-lg text-right shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-visu-mint block">
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

            {/* ---------------------------------------------------------- */}
            {/* BLOQUES 1 & 2: CLIENTE Y VEHÍCULO                          */}
            {/* ---------------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              {/* BLOQUE 1: DATOS DEL CLIENTE */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 print:p-3 print:bg-white print:border-slate-300 space-y-3 print-avoid-break">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                  <div className="w-6 h-6 rounded-lg bg-visu-mint/20 text-visu-blue flex items-center justify-center shrink-0">
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
                    <div className="w-6 h-6 rounded-lg bg-visu-mint/20 text-visu-blue flex items-center justify-center shrink-0">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      2. Ficha del Vehículo
                    </h2>
                  </div>

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
                      <p className="font-extrabold text-visu-blue font-mono">{kmVehiculo}</p>
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

            {/* ---------------------------------------------------------- */}
            {/* BLOQUE 3: MOTIVO DE INGRESO Y DIAGNÓSTICO PRELIMINAR       */}
            {/* ---------------------------------------------------------- */}
            <div className="bg-white border border-slate-200 rounded-xl p-4.5 print:p-3 print:border-slate-300 space-y-3 print-avoid-break">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-visu-mint/20 text-visu-blue flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    3. Motivo de Ingreso y Requerimiento
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-visu-mint/20 text-visu-blue border border-visu-mint/40">
                    Tipo: {tipoServicioLabel}
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    Entrega Estimada: <strong>{fechaEstimadaEntrega}</strong>
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/90 rounded-lg p-3.5 border border-slate-200/80 text-xs text-slate-800 leading-relaxed space-y-1.5 print:bg-slate-50 print:border-slate-300">
                {lineasDiagnostico.map((linea, idx) => {
                  const esBullet = linea.startsWith('•') || linea.startsWith('-');
                  return (
                    <p
                      key={idx}
                      className={
                        esBullet
                          ? 'font-medium pl-1 text-slate-800'
                          : 'font-normal text-slate-700'
                      }
                    >
                      {linea}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* BLOQUE 4: REGISTRO FOTOGRÁFICO DE RECEPCIÓN (5 ÁREAS)      */}
            {/* ---------------------------------------------------------- */}
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
                    Sin fotografías adjuntas al ingreso inicial.
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
                        <div className="relative aspect-4/3 w-full bg-slate-200 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.url_archivo}
                            alt={`Evidencia ${tagSeccion}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto(ev.url_archivo)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white print:hidden cursor-pointer"
                            title="Ver fotografía en tamaño completo"
                          >
                            <Maximize2 className="w-5 h-5 drop-shadow-md" />
                          </button>
                        </div>

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

            {/* ---------------------------------------------------------- */}
            {/* BLOQUE 5: HALLAZGOS Y DIAGNÓSTICO EN TALLER                */}
            {/* (SOLO LECTURA - SIN BOTONES DE EDICIÓN NI CONTINUAR)       */}
            {/* ---------------------------------------------------------- */}
            <div className="bg-white border border-slate-200 rounded-xl p-4.5 print:p-3 print:border-slate-300 space-y-3.5 print-avoid-break">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-visu-blue text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    5. Hallazgos y Diagnóstico en Taller ({hallazgos.length} Ítems)
                  </h2>
                </div>
              </div>

              {hallazgos.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50 space-y-1.5">
                  <Wrench className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-700 font-semibold">
                    Unidad en proceso de inspección y diagnóstico técnico en taller.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Los detalles específicos y cotización se reflejarán en este informe una vez finalizada la revisión en elevador.
                  </p>
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

            {/* ---------------------------------------------------------- */}
            {/* BLOQUE 6: RESUMEN PRESUPUESTARIO Y LIQUIDACIÓN             */}
            {/* ---------------------------------------------------------- */}
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
                    * Los valores detallados corresponden a mano de obra calificada e insumos
                    descritos en los hallazgos técnicos.
                  </p>
                  <p>* Cotización sujeta a aprobación previa del cliente.</p>
                </div>

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
                    <span className="font-mono text-base font-black text-visu-blue">
                      {formatearPesos(totalGeneral)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* BLOQUE 7: TÉRMINOS LEGALES Y GARANTÍA                      */}
            {/* ---------------------------------------------------------- */}
            <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4.5 print:p-3 print:bg-white print:border-slate-300 space-y-4 print-avoid-break">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 block">
                  7. Términos de Recepción y Garantía
                </span>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  <strong>Visú Taller Mecánico</strong> garantiza la mano de obra y repuestos provistos por un periodo de 3 meses o 5.000 km, lo que ocurra primero. El taller no se responsabiliza por objetos de valor no declarados en el inventario inicial.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-3 print:gap-4">
                <div className="border border-slate-300 rounded-lg p-3 bg-white text-center flex flex-col justify-between h-28 print:h-24">
                  <div className="h-10"></div>
                  <div>
                    <div className="border-t border-slate-400 mx-4 pt-1">
                      <p className="text-[11px] font-bold text-slate-900">
                        Visú Taller Mecánico
                      </p>
                      <p className="text-[9px] text-slate-600 font-medium">
                        Control de Calidad & Recepción
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-lg p-3 bg-white text-center flex flex-col justify-between h-28 print:h-24">
                  <div className="h-10"></div>
                  <div>
                    <div className="border-t border-slate-400 mx-4 pt-1">
                      <p className="text-[11px] font-bold text-slate-900 truncate">
                        Conformidad del Cliente
                      </p>
                      <p className="text-[9px] text-slate-600 font-medium truncate">
                        {nombreCliente} • RUT: {rutCliente}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[9px] text-slate-600">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-visu-mint-dark" />
                  <span>Documento Oficial Visú Taller Mecánico • Registro Digital de Trazabilidad</span>
                </div>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* 3. MODAL LIGHTBOX PARA ZOOM DE FOTOS                         */}
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
