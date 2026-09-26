// ==========================================
// Tipos e Interfaces Estrictas para Visú
// ==========================================

export type TipoServicio = 'mantencion' | 'reparacion';

export const TIPO_SERVICIO_LABELS: Record<TipoServicio, string> = {
  mantencion: 'Mantención Preventiva',
  reparacion: 'Reparación Correctiva',
};

export type EstadoOrden =
  | 'recibido'
  | 'en_revision'
  | 'esperando_aprobacion'
  | 'en_reparacion'
  | 'listo'
  | 'entregado'
  | 'en_proceso'
  | 'cancelado';

export const ESTADO_ORDEN_LABELS: Record<EstadoOrden, string> = {
  recibido: 'Recibido',
  en_revision: 'En Revisión',
  esperando_aprobacion: 'Aceptación Presupuesto',
  en_reparacion: 'En Reparación',
  listo: 'Listo para Entrega',
  entregado: 'Entregado',
  en_proceso: 'En Proceso',
  cancelado: 'Cancelado',
};

export type AreaEvidencia =
  | 'Frontal'
  | 'Capó'
  | 'Costado Izquierdo'
  | 'Costado Derecho'
  | 'Llantas';

export const AREAS_EVIDENCIA: AreaEvidencia[] = [
  'Frontal',
  'Capó',
  'Costado Izquierdo',
  'Costado Derecho',
  'Llantas',
];

// Modelos de Base de Datos (PostgreSQL en Supabase)
export interface Cliente {
  id?: number | string;
  rut_dni: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
}

export interface Vehiculo {
  id?: number | string;
  cliente_id?: number | string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje: number;
  color: string;
}

export interface OrdenTrabajo {
  id?: number | string;
  numero_ot?: number | string;
  cliente_id?: number | string;
  vehiculo_id?: number | string;
  estado: EstadoOrden;
  tipo_servicio: TipoServicio;
  descripcion_cliente: string;
  fecha_estimada_entrega: string;
}

export interface EvidenciaOrden {
  id?: number | string;
  orden_trabajo_id?: number | string;
  etapa: 'recepcion' | 'proceso' | 'entrega';
  seccion: AreaEvidencia;
  url_archivo: string;
}

// Estados del Formulario Wizard de Recepción
export interface ClientFormData {
  rut_dni: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
}

export interface VehicleFormData {
  patente: string;
  marca: string;
  modelo: string;
  anio: string; // En el formulario se maneja como string para inputs controlados
  kilometraje: string;
  color: string;
}

export interface DiagnosticFormData {
  tipo_servicio: TipoServicio;
  descripcion_cliente: string;
  fecha_estimada_entrega: string;
}

export interface EvidenceFileState {
  area: AreaEvidencia;
  file: File | null;
  previewUrl: string | null;
  uploadedUrl: string | null;
  isUploading: boolean;
  error: string | null;
}

export interface ReceptionFormData {
  cliente: ClientFormData;
  vehiculo: VehicleFormData;
  diagnostico: DiagnosticFormData;
  evidencias: Record<AreaEvidencia, { url: string; area: AreaEvidencia } | null>;
}

// Payload de entrada para la Server Action
export interface ReceptionPayload {
  cliente: ClientFormData;
  vehiculo: {
    patente: string;
    marca: string;
    modelo: string;
    anio: number;
    kilometraje: number;
    color: string;
  };
  diagnostico: DiagnosticFormData;
  evidencias: Array<{
    area: AreaEvidencia;
    url_archivo: string;
  }>;
}

// Resultado retornado por la Server Action
export type ReceptionActionResult =
  | {
      success: true;
      numero_ot: string;
      orden_id: number | string;
      data: {
        cliente: {
          nombreCompleto: string;
          rut_dni: string;
          correo: string;
          telefono: string;
        };
        vehiculo: {
          patente: string;
          vehiculoCompleto: string;
          kilometraje: number;
          color: string;
        };
        orden: {
          tipo_servicio: TipoServicio;
          descripcion_cliente: string;
          fecha_estimada_entrega: string;
        };
        totalEvidencias: number;
      };
    }
  | {
      success: false;
      error: string;
    };
