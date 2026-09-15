'use server';

import { supabase } from '@/lib/supabaseClient';
import type {
  ReceptionPayload,
  ReceptionActionResult,
  TipoServicio,
} from '@/types/visu';

/**
 * Normaliza y limpia strings de entrada
 */
function sanitizeString(str: string): string {
  return (str || '').trim();
}

/**
 * Genera el siguiente número de OT correlativo de forma amigable (Ej: OT-1001, OT-1002)
 */
async function generateNextOTNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('numero_ot')
      .order('id', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 'OT-1001';
    }

    const lastOtStr = data[0].numero_ot;
    if (typeof lastOtStr === 'string') {
      const match = lastOtStr.match(/\d+/);
      if (match) {
        const nextNum = parseInt(match[0], 10) + 1;
        return `OT-${nextNum}`;
      }
    }

    const { count } = await supabase
      .from('ordenes_trabajo')
      .select('*', { count: 'exact', head: true });

    const nextCorrelative = 1000 + (count ? count + 1 : 1);
    return `OT-${nextCorrelative}`;
  } catch {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `OT-${randomSuffix}`;
  }
}

/**
 * Server Action principal para registrar la recepción completa del vehículo en Supabase
 */
export async function registrarRecepcionVehiculo(
  payload: ReceptionPayload
): Promise<ReceptionActionResult> {
  try {
    // -------------------------------------------------------------
    // 1. VALIDACIÓN ESTRICTA DE ENTRADA
    // -------------------------------------------------------------
    const rut_dni = sanitizeString(payload.cliente.rut_dni);
    const nombre = sanitizeString(payload.cliente.nombre);
    const apellido = sanitizeString(payload.cliente.apellido);
    const correo = sanitizeString(payload.cliente.correo).toLowerCase();
    const telefono = sanitizeString(payload.cliente.telefono);

    if (!rut_dni || !nombre || !apellido || !correo || !telefono) {
      return {
        success: false,
        error: 'Todos los campos de datos del cliente son obligatorios.',
      };
    }

    const patente = sanitizeString(payload.vehiculo.patente).toUpperCase().replace(/\s+/g, '');
    const marca = sanitizeString(payload.vehiculo.marca);
    const modelo = sanitizeString(payload.vehiculo.modelo);
    const color = sanitizeString(payload.vehiculo.color);
    const anio = Number(payload.vehiculo.anio);
    const kilometraje = Number(payload.vehiculo.kilometraje);

    if (!patente || !marca || !modelo || !color || isNaN(anio) || isNaN(kilometraje)) {
      return {
        success: false,
        error: 'Todos los campos del vehículo deben ser válidos y numéricos donde corresponda.',
      };
    }

    const tipo_servicio: TipoServicio = payload.diagnostico.tipo_servicio;
    const descripcion_cliente = sanitizeString(payload.diagnostico.descripcion_cliente);
    const fecha_estimada_entrega = sanitizeString(payload.diagnostico.fecha_estimada_entrega);

    if (!tipo_servicio || !descripcion_cliente || !fecha_estimada_entrega) {
      return {
        success: false,
        error: 'Debe especificar el tipo de servicio, diagnóstico y fecha estimada de entrega.',
      };
    }

    // -------------------------------------------------------------
    // 2. REGISTRO O ACTUALIZACIÓN DEL CLIENTE (tabla: clientes)
    // -------------------------------------------------------------
    let clienteId: number | string | null = null;

    // Buscar si ya existe por rut_dni o por correo
    const { data: clienteExistente, error: searchClienteError } = await supabase
      .from('clientes')
      .select('id, rut_dni, correo')
      .or(`rut_dni.eq.${rut_dni},correo.eq.${correo}`)
      .limit(1)
      .maybeSingle();

    if (searchClienteError && searchClienteError.code !== 'PGRST116') {
      console.error('Error al buscar cliente:', searchClienteError);
    }

    if (clienteExistente?.id) {
      clienteId = clienteExistente.id;
      // Actualizar datos de contacto más recientes
      await supabase
        .from('clientes')
        .update({
          nombre,
          apellido,
          correo,
          telefono,
          rut_dni,
        })
        .eq('id', clienteId);
    } else {
      // Insertar nuevo cliente
      const { data: nuevoCliente, error: insertClienteError } = await supabase
        .from('clientes')
        .insert({
          rut_dni,
          nombre,
          apellido,
          correo,
          telefono,
        })
        .select('id')
        .single();

      if (insertClienteError || !nuevoCliente) {
        return {
          success: false,
          error: `Error al registrar el cliente en base de datos: ${insertClienteError?.message || 'Fallo inesperado'}`,
        };
      }
      clienteId = nuevoCliente.id;
    }

    // -------------------------------------------------------------
    // 3. REGISTRO O ACTUALIZACIÓN DEL VEHÍCULO (tabla: vehiculos)
    // -------------------------------------------------------------
    let vehiculoId: number | string | null = null;

    const { data: vehiculoExistente } = await supabase
      .from('vehiculos')
      .select('id, patente')
      .eq('patente', patente)
      .limit(1)
      .maybeSingle();

    if (vehiculoExistente?.id) {
      vehiculoId = vehiculoExistente.id;
      // Actualizar información técnica del vehículo y asignar al cliente actual
      await supabase
        .from('vehiculos')
        .update({
          cliente_id: clienteId,
          marca,
          modelo,
          anio,
          kilometraje,
          color,
        })
        .eq('id', vehiculoId);
    } else {
      const { data: nuevoVehiculo, error: insertVehiculoError } = await supabase
        .from('vehiculos')
        .insert({
          cliente_id: clienteId,
          patente,
          marca,
          modelo,
          anio,
          kilometraje,
          color,
        })
        .select('id')
        .single();

      if (insertVehiculoError || !nuevoVehiculo) {
        return {
          success: false,
          error: `Error al registrar el vehículo: ${insertVehiculoError?.message || 'Fallo inesperado'}`,
        };
      }
      vehiculoId = nuevoVehiculo.id;
    }

    // -------------------------------------------------------------
    // 4. CREACIÓN DE LA ORDEN DE TRABAJO (tabla: ordenes_trabajo)
    // -------------------------------------------------------------
    const numero_ot = await generateNextOTNumber();

    const { data: nuevaOrden, error: insertOrdenError } = await supabase
      .from('ordenes_trabajo')
      .insert({
        numero_ot,
        cliente_id: clienteId,
        vehiculo_id: vehiculoId,
        estado: 'recibido',
        tipo_servicio,
        descripcion_cliente,
        fecha_estimada_entrega,
      })
      .select('id, numero_ot')
      .single();

    if (insertOrdenError || !nuevaOrden) {
      return {
        success: false,
        error: `Error al generar la orden de trabajo: ${insertOrdenError?.message || 'Fallo inesperado'}`,
      };
    }

    const ordenId = nuevaOrden.id;
    const finalNumeroOT = nuevaOrden.numero_ot || numero_ot;

    // -------------------------------------------------------------
    // 5. REGISTRO DE EVIDENCIAS FOTOGRÁFICAS (tabla: evidencias_orden)
    // -------------------------------------------------------------
    if (payload.evidencias && payload.evidencias.length > 0) {
      const evidenciasParaInsertar = payload.evidencias
        .filter((ev) => ev.url_archivo && ev.url_archivo.trim().length > 0)
        .map((ev) => ({
          orden_trabajo_id: ordenId,
          etapa: 'recepcion' as const,
          seccion: ev.area,
          url_archivo: ev.url_archivo,
        }));

      if (evidenciasParaInsertar.length > 0) {
        const { error: insertEvidenciasError } = await supabase
          .from('evidencias_orden')
          .insert(evidenciasParaInsertar);

        if (insertEvidenciasError) {
          console.warn('Aviso: Hubo un inconveniente registrando evidencias secundarias:', insertEvidenciasError);
        }
      }
    }

    // -------------------------------------------------------------
    // 6. RETORNO EXITOSO CON DETALLE FORMATEADO
    // -------------------------------------------------------------
    return {
      success: true,
      numero_ot: finalNumeroOT,
      orden_id: ordenId,
      data: {
        cliente: {
          nombreCompleto: `${nombre} ${apellido}`,
          rut_dni,
          correo,
          telefono,
        },
        vehiculo: {
          patente,
          vehiculoCompleto: `${marca} ${modelo} (${anio})`,
          kilometraje,
          color,
        },
        orden: {
          tipo_servicio,
          descripcion_cliente,
          fecha_estimada_entrega,
        },
        totalEvidencias: payload.evidencias ? payload.evidencias.length : 0,
      },
    };
  } catch (error: unknown) {
    console.error('Error no controlado en registrarRecepcionVehiculo:', error);
    const mensaje = error instanceof Error ? error.message : 'Error interno del servidor';
    return {
      success: false,
      error: `No se pudo procesar la recepción: ${mensaje}`,
    };
  }
}
