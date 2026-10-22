'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  Wrench,
  Sparkles,
  Mic,
  MicOff,
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calculator,
  ChevronRight,
  ImageIcon,
  Save,
  RefreshCw,
} from 'lucide-react';

// Declaraciones para Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// =========================================================================
// INTERFACES DEL MÓDULO
// =========================================================================
export interface ItemHallazgo {
  id: string; // ID local único para React key
  dbId?: number | string; // ID en Supabase si ya existía
  titulo: string;
  descripcion: string;
  url_foto: string | null;
  valor_neto: number;
  isUploadingPhoto?: boolean;
  isGeneratingAI?: boolean;
  aiSuccessMessage?: string | null;
}

interface OrdenResumen {
  id: number | string;
  numero_ot?: number | string;
  estado: string;
  tipo_servicio: string;
  vehiculos?: {
    patente: string;
    marca: string;
    modelo: string;
  } | null;
  clientes?: {
    nombre: string;
    apellido: string;
  } | null;
}

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

// Helper para formateo de pesos chilenos
function formatearPesos(monto: number): string {
  return `$ ${Math.round(monto).toLocaleString('es-CL')}`;
}

export default function EjecutarReparacionPage(props: PageProps) {
  const router = useRouter();
  const routeParams = useParams();
  const unwrappedParams = props?.params
    ? typeof (props.params as Promise<{ id: string }>).then === 'function'
      ? use(props.params as Promise<{ id: string }>)
      : (props.params as { id: string })
    : null;
  const rawId = (unwrappedParams?.id || routeParams?.id) as string;

  // Estado del Wizard (Paso 1: Hallazgos, Paso 2: Valorización)
  const [paso, setPaso] = useState<1 | 2>(1);
  const [orden, setOrden] = useState<OrdenResumen | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Lista de hallazgos
  const [hallazgos, setHallazgos] = useState<ItemHallazgo[]>([
    {
      id: 'item-inicial-1',
      titulo: '',
      descripcion: '',
      url_foto: null,
      valor_neto: 0,
    },
  ]);

  // Estado de Dictado por Voz
  const [activeDictationItemId, setActiveDictationItemId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textBeforeDictationRef = useRef<string>('');

  // Refs para inputs de archivo por ítem
  const cameraInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const galleryInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // -----------------------------------------------------------------------
  // CARGA DE DATOS DE LA ORDEN Y HALLAZGOS PREVIOS
  // -----------------------------------------------------------------------
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!rawId) return;

      try {
        setLoading(true);
        setGlobalError(null);

        // 1. Obtener orden
        const numericId = Number(rawId);
        let query = supabase
          .from('ordenes_trabajo')
          .select(`
            id,
            numero_ot,
            estado,
            tipo_servicio,
            clientes:cliente_id (
              nombre,
              apellido
            ),
            vehiculos:vehiculo_id (
              patente,
              marca,
              modelo
            )
          `);

        if (!isNaN(numericId)) {
          query = query.or(`id.eq.${numericId},numero_ot.eq.${numericId}`);
        } else {
          query = query.eq('id', rawId);
        }

        const { data: ordenData, error: ordenErr } = await query.maybeSingle();

        if (ignore) return;

        if (ordenErr || !ordenData) {
          setGlobalError('No se encontró la orden de trabajo especificada.');
          setLoading(false);
          return;
        }

        const clienteObj = Array.isArray(ordenData.clientes)
          ? ordenData.clientes[0] || null
          : ordenData.clientes;
        const vehiculoObj = Array.isArray(ordenData.vehiculos)
          ? ordenData.vehiculos[0] || null
          : ordenData.vehiculos;

        // Si la orden estaba en estado 'recibido', transicionar automáticamente a 'en_revision'
        let estadoActualizado = ordenData.estado;
        if (ordenData.estado === 'recibido') {
          const { error: updErr } = await supabase
            .from('ordenes_trabajo')
            .update({ estado: 'en_revision' })
            .eq('id', ordenData.id);
          if (!updErr) {
            estadoActualizado = 'en_revision';
          } else {
            console.error('Error actualizando a en_revision:', updErr);
          }
        }

        setOrden({
          ...ordenData,
          estado: estadoActualizado,
          clientes: clienteObj,
          vehiculos: vehiculoObj,
        });

        // Revisar si viene parametro de paso=2 en la URL
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('paso') === '2') {
            setPaso(2);
          }
        }

        // 2. Obtener hallazgos existentes si los hubiera
        const actualOrdenId = ordenData.id;
        const { data: hallazgosData, error: hallazgosErr } = await supabase
          .from('hallazgos_ot')
          .select('*')
          .eq('orden_trabajo_id', actualOrdenId)
          .order('id', { ascending: true });

        if (ignore) return;

        if (!hallazgosErr && hallazgosData && hallazgosData.length > 0) {
          const itemsMapeados: ItemHallazgo[] = hallazgosData.map((h, idx) => ({
            id: `item-db-${h.id || idx}`,
            dbId: h.id,
            titulo: h.titulo || '',
            descripcion: h.descripcion || '',
            url_foto: h.url_foto || h.url_archivo || null,
            valor_neto: Number(h.valor_neto) || 0,
          }));
          setHallazgos(itemsMapeados);
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Error al cargar datos en ejecución:', err);
          setGlobalError('Ocurrió un error al cargar la información de la orden.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [rawId]);

  // -----------------------------------------------------------------------
  // GESTIÓN DE ÍTEMS / HALLAZGOS
  // -----------------------------------------------------------------------
  const handleAgregarItem = () => {
    setHallazgos((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        titulo: '',
        descripcion: '',
        url_foto: null,
        valor_neto: 0,
      },
    ]);
  };

  const handleEliminarItem = (id: string) => {
    if (hallazgos.length <= 1) return;
    setHallazgos((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFieldChange = (
    id: string,
    field: 'titulo' | 'descripcion' | 'valor_neto',
    value: string | number
  ) => {
    setHallazgos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // -----------------------------------------------------------------------
  // GENERAR TÍTULO Y DESCRIPCIÓN CON IA (GROQ)
  // -----------------------------------------------------------------------
  const handleGenerarConIA = async (item: ItemHallazgo) => {
    const textoBase = item.descripcion.trim() || item.titulo.trim();
    if (!textoBase) {
      setGlobalError('Escribe o dicta algunas notas en el ítem antes de optimizar con IA.');
      setTimeout(() => setGlobalError(null), 4000);
      return;
    }

    // Activar spinner en este ítem
    setHallazgos((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isGeneratingAI: true } : i))
    );

    try {
      const res = await fetch('/api/generar-item-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoBase }),
      });

      if (!res.ok) {
        throw new Error(`Error en servidor IA (${res.status})`);
      }

      const data = await res.json();

      if (data.titulo && data.descripcion) {
        setHallazgos((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  titulo: data.titulo,
                  descripcion: data.descripcion,
                  isGeneratingAI: false,
                  aiSuccessMessage: '¡Estructurado con IA!',
                }
              : i
          )
        );

        setTimeout(() => {
          setHallazgos((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, aiSuccessMessage: null } : i))
          );
        }, 3000);
      } else {
        throw new Error('Formato de respuesta no esperado.');
      }
    } catch (err: unknown) {
      console.error('Error generando ítem con IA:', err);
      setGlobalError('No se pudo estructurar el ítem con IA. Inténtalo de nuevo.');
      setTimeout(() => setGlobalError(null), 4000);
      setHallazgos((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isGeneratingAI: false } : i))
      );
    }
  };

  // -----------------------------------------------------------------------
  // DICTADO POR VOZ (WEB SPEECH API) POR ÍTEM
  // -----------------------------------------------------------------------
  const handleToggleDictado = (item: ItemHallazgo) => {
    if (activeDictationItemId === item.id) {
      // Detener
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setActiveDictationItemId(null);
      return;
    }

    // Detener previo si existía
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    if (typeof window === 'undefined') return;

    const SpeechConstructor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechConstructor) {
      setGlobalError('El dictado por voz no es compatible con este navegador.');
      setTimeout(() => setGlobalError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechConstructor();
      recognitionRef.current = recognition;
      recognition.lang = 'es-CL';
      recognition.continuous = true;
      recognition.interimResults = true;

      textBeforeDictationRef.current = item.descripcion;

      recognition.onstart = () => {
        setActiveDictationItemId(item.id);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const combined = (finalTranscript + interimTranscript).trim();
        const base = textBeforeDictationRef.current.trim();
        const nuevoTexto = base ? `${base} ${combined}` : combined;

        setHallazgos((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, descripcion: nuevoTexto } : i))
        );
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech error:', event.error);
        setActiveDictationItemId(null);
      };

      recognition.onend = () => {
        setActiveDictationItemId(null);
      };

      recognition.start();
    } catch (e) {
      console.error('No se pudo iniciar dictado:', e);
      setActiveDictationItemId(null);
    }
  };

  // -----------------------------------------------------------------------
  // SUBIDA DE FOTOS POR ÍTEM A SUPABASE STORAGE
  // -----------------------------------------------------------------------
  const handleFileSelect = async (itemId: string, file: File) => {
    if (!file) return;

    const localPreview = URL.createObjectURL(file);

    // Vista previa inmediata y estado subiendo
    setHallazgos((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, url_foto: localPreview, isUploadingPhoto: true }
          : i
      )
    );

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const patente = orden?.vehiculos?.patente || 'SIN-PATENTE';
      const fileName = `hallazgos/${patente}_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('visu-evidencias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        console.warn('Aviso al subir foto Storage:', uploadErr.message);
        setHallazgos((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, isUploadingPhoto: false, url_foto: localPreview }
              : i
          )
        );
        return;
      }

      const { data: urlData } = supabase.storage
        .from('visu-evidencias')
        .getPublicUrl(uploadData.path);

      setHallazgos((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                isUploadingPhoto: false,
                url_foto: urlData.publicUrl || localPreview,
              }
            : i
        )
      );
    } catch (err: unknown) {
      console.error('Error subiendo foto de hallazgo:', err);
      setHallazgos((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, isUploadingPhoto: false, url_foto: localPreview }
            : i
        )
      );
    }
  };

  const handleEliminarFoto = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHallazgos((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, url_foto: null } : i))
    );
  };

  // -----------------------------------------------------------------------
  // CÁLCULOS DE VALORIZACIÓN (NETO, IVA 19%, TOTAL)
  // -----------------------------------------------------------------------
  const subtotalNeto = hallazgos.reduce((acc, curr) => {
    const val = typeof curr.valor_neto === 'number' ? curr.valor_neto : parseFloat(curr.valor_neto) || 0;
    return acc + Math.max(0, val);
  }, 0);

  const iva19 = Math.round(subtotalNeto * 0.19);
  const totalGeneral = subtotalNeto + iva19;

  // -----------------------------------------------------------------------
  // PERSISTENCIA DE HALLAZGOS Y ACTUALIZACIÓN DE ESTADO EN BD
  // -----------------------------------------------------------------------
  const persistirHallazgos = async (nuevoEstadoOrden: 'en_revision' | 'esperando_aprobacion') => {
    if (!orden?.id) throw new Error('No se encontró la orden activa.');

    // Validación básica: al menos un ítem con título o descripción
    const itemsValidos = hallazgos.filter(
      (h) => h.titulo.trim().length > 0 || h.descripcion.trim().length > 0
    );

    if (itemsValidos.length === 0) {
      throw new Error('Debes ingresar al menos un hallazgo con título o descripción antes de guardar.');
    }

    const actualOrdenId = orden.id;

    // 1. Limpiar hallazgos previos e insertar el set actual
    await supabase
      .from('hallazgos_ot')
      .delete()
      .eq('orden_trabajo_id', actualOrdenId);

    const filasParaInsertar = itemsValidos.map((item) => ({
      orden_trabajo_id: actualOrdenId,
      titulo: item.titulo.trim() || 'Hallazgo Técnico',
      descripcion: item.descripcion.trim(),
      url_foto: item.url_foto,
      valor_neto: typeof item.valor_neto === 'number' ? item.valor_neto : parseFloat(item.valor_neto) || 0,
    }));

    const { error: insertErr } = await supabase
      .from('hallazgos_ot')
      .insert(filasParaInsertar);

    if (insertErr) {
      console.error('Error al insertar hallazgos:', insertErr);
      throw new Error(`Error al registrar hallazgos: ${insertErr.message}`);
    }

    // 2. Actualizar estado de la orden en Supabase
    const { error: updateOrderErr } = await supabase
      .from('ordenes_trabajo')
      .update({ estado: nuevoEstadoOrden })
      .eq('id', actualOrdenId);

    if (updateOrderErr) {
      console.error('Error al actualizar estado en ordenes_trabajo:', updateOrderErr);
      throw new Error(`Error al actualizar estado de la orden: ${updateOrderErr.message}`);
    }

    setOrden((prev) => (prev ? { ...prev, estado: nuevoEstadoOrden } : null));
    return actualOrdenId;
  };

  // Botón 1: Grabar Hallazgos y Continuar Después (Guarda en 'en_revision' y redirige a la OT)
  const handleGrabarYContinuarDespues = async () => {
    try {
      setSaving(true);
      setGlobalError(null);

      const actualOrdenId = await persistirHallazgos('en_revision');

      setGlobalSuccess('¡Hallazgos guardados exitosamente! La orden continúa en revisión.');
      setTimeout(() => {
        router.push(`/ordenes/${actualOrdenId}`);
      }, 700);
    } catch (err: unknown) {
      console.error('Error guardando hallazgos para continuar después:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar';
      setGlobalError(msg);
      setSaving(false);
    }
  };

  // Botón 2: Hallazgos Terminados: Pasar a Presupuesto (Guarda en 'esperando_aprobacion' y avanza a paso 2)
  const handleTerminarYPasarAPresupuesto = async () => {
    try {
      setSaving(true);
      setGlobalError(null);

      await persistirHallazgos('esperando_aprobacion');

      setSaving(false);
      setPaso(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      console.error('Error pasando a presupuesto:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al pasar a presupuesto';
      setGlobalError(msg);
      setSaving(false);
    }
  };

  // Botón Paso 2: Guardar Hallazgos y Presupuesto Final
  const handleGuardarTodo = async () => {
    try {
      setSaving(true);
      setGlobalError(null);

      const actualOrdenId = await persistirHallazgos('esperando_aprobacion');

      setGlobalSuccess('¡Hallazgos y presupuesto valorizado guardados con éxito!');
      setTimeout(() => {
        router.push(`/ordenes/${actualOrdenId}`);
      }, 700);
    } catch (err: unknown) {
      console.error('Error guardando presupuesto final:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar';
      setGlobalError(msg);
      setSaving(false);
    }
  };

  const numeroOT =
    orden?.numero_ot !== undefined && orden?.numero_ot !== null
      ? String(orden.numero_ot).startsWith('OT')
        ? orden.numero_ot
        : `OT #${orden.numero_ot}`
      : `OT #${rawId}`;

  const patente = orden?.vehiculos?.patente || 'S/P';
  const auto = orden?.vehiculos ? `${orden.vehiculos.marca} ${orden.vehiculos.modelo}` : 'Vehículo';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24">
      {/* ============================================================ */}
      {/* CABECERA SUPERIOR & NAVEGACIÓN                                */}
      {/* ============================================================ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/ordenes/${rawId}`}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a OT</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900">{numeroOT}</span>
            <span className="inline-flex items-center bg-slate-900 text-white font-mono font-bold text-xs px-2 py-0.5 rounded">
              {patente}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-visu-blue" />
              <span>Ejecutar Reparación & Hallazgos</span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">{auto}</p>
          </div>

          {/* Selector de Pasos */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                paso === 1
                  ? 'bg-visu-blue text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Hallazgos
            </button>
            <button
              type="button"
              onClick={() => setPaso(2)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                paso === 2
                  ? 'bg-visu-blue text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Presupuesto
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MENSAJES GLOBALES DE ERROR O ÉXITO                           */}
      {/* ============================================================ */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-center gap-2 shadow-2xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="flex-1 font-medium">{globalError}</span>
        </div>
      )}

      {globalSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 shadow-2xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="flex-1 font-bold">{globalSuccess}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* ESTADO DE CARGA INICIAL                                      */}
      {/* ============================================================ */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-visu-blue animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Cargando orden y hallazgos...</p>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 1: LISTADO DE HALLAZGOS Y DIAGNÓSTICO EN ELEVADOR       */}
      {/* ============================================================ */}
      {!loading && paso === 1 && (
        <div className="space-y-4">
          <div className="bg-visu-mint/20 border border-visu-mint/40 rounded-xl p-3 text-xs text-slate-900 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-visu-blue shrink-0" />
            <span>
              Registra cada anomalía o repuesto detectado en taller. Usa <strong>Dictar</strong> o{' '}
              <strong>Mejorar con IA</strong> para autogenerar títulos y redacción técnica.
            </span>
          </div>

          {/* Tarjetas de Hallazgos */}
          {hallazgos.map((item, index) => {
            const isListeningThis = activeDictationItemId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 transition-all hover:border-slate-300"
              >
                {/* Cabecera de la Tarjeta del Hallazgo */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-visu-blue text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      {index + 1}
                    </span>
                    <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                      Hallazgo #{index + 1}
                    </span>
                  </div>

                  {hallazgos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleEliminarItem(item.id)}
                      className="text-slate-600 hover:text-red-600 p-1 rounded-lg transition-colors"
                      title="Eliminar este hallazgo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Campo de Título */}
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-slate-700 tracking-wider block">
                    Título Técnico del Hallazgo o Repuesto
                  </label>
                  <input
                    type="text"
                    value={item.titulo}
                    onChange={(e) => handleFieldChange(item.id, 'titulo', e.target.value)}
                    placeholder="ej: Desgaste severo en pastillas delanteras"
                    className="w-full font-semibold text-sm"
                  />
                </div>

                {/* Campo de Descripción y Botones IA / Dictado */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] uppercase font-bold text-slate-700 tracking-wider">
                      Descripción y Notas del Mecánico
                    </label>

                    <div className="flex items-center gap-1.5">
                      {/* Botón Dictar */}
                      <button
                        type="button"
                        onClick={() => handleToggleDictado(item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          isListeningThis
                            ? 'bg-red-600 text-white animate-pulse shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title="Dictar notas por voz"
                      >
                        {isListeningThis ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            <span>Escuchando...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-visu-blue" />
                            <span>Dictar</span>
                          </>
                        )}
                      </button>

                      {/* Botón Generar con IA */}
                      <button
                        type="button"
                        onClick={() => handleGenerarConIA(item)}
                        disabled={item.isGeneratingAI}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-visu-mint/20 hover:bg-visu-mint/30 text-visu-blue border border-visu-mint/40 transition-colors disabled:opacity-60 cursor-pointer"
                        title="Generar título y mejorar redacción con IA"
                      >
                        {item.isGeneratingAI ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Estructurando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-visu-blue" />
                            <span>✨ Mejorar con IA</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {item.aiSuccessMessage && (
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{item.aiSuccessMessage}</span>
                    </p>
                  )}

                  <textarea
                    rows={3}
                    value={item.descripcion}
                    onChange={(e) => handleFieldChange(item.id, 'descripcion', e.target.value)}
                    placeholder="Describe el estado de la pieza, fuga de fluidos, holgura, ruido o síntoma encontrado..."
                    className="w-full text-xs leading-relaxed"
                  />
                </div>

                {/* Zona de Fotografía del Hallazgo */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] uppercase font-bold text-slate-700 tracking-wider block">
                    Fotografía del Hallazgo (Opcional)
                  </span>

                  {/* Inputs ocultos de archivo */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={(el) => {
                      cameraInputRefs.current[item.id] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(item.id, file);
                    }}
                    className="hidden"
                  />

                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => {
                      galleryInputRefs.current[item.id] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(item.id, file);
                    }}
                    className="hidden"
                  />

                  {item.url_foto ? (
                    <div className="relative w-full max-w-xs h-36 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url_foto}
                        alt="Evidencia hallazgo"
                        className="w-full h-full object-cover"
                      />

                      {item.isUploadingPhoto && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs gap-1">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Subiendo...</span>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => cameraInputRefs.current[item.id]?.click()}
                          className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg text-xs"
                          title="Reemplazar foto con cámara"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleEliminarFoto(item.id, e)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRefs.current[item.id]?.click()}
                        className="flex-1 py-2.5 px-3 rounded-xl border border-dashed border-visu-mint/60 hover:border-visu-mint bg-visu-mint/5 hover:bg-visu-mint/15 text-slate-900 transition-colors flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-visu-blue" />
                        <span>Tomar Foto con Cámara</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRefs.current[item.id]?.click()}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title="Subir desde galería"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span className="hidden sm:inline">Galería</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Botón "+ Agregar otro hallazgo" */}
          <button
            type="button"
            onClick={handleAgregarItem}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-visu-mint bg-white hover:bg-visu-mint/5 text-slate-700 hover:text-visu-blue font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar otro hallazgo</span>
          </button>

          {/* Pie de Página de Hallazgos: Dos Acciones */}
          <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
            {/* Botón 1: Grabar Hallazgos y Continuar Después */}
            <button
              type="button"
              disabled={saving}
              onClick={handleGrabarYContinuarDespues}
              className="w-full sm:w-auto flex-1 border-2 border-slate-300 hover:border-slate-400 bg-white text-slate-700 font-semibold py-3.5 px-5 rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <Save className="w-4 h-4 text-slate-600" />
              )}
              <span>💾 Grabar Hallazgos y Continuar Después</span>
            </button>

            {/* Botón 2: Hallazgos Terminados: Pasar a Presupuesto */}
            <button
              type="button"
              disabled={saving}
              onClick={handleTerminarYPasarAPresupuesto}
              className="w-full sm:w-auto flex-1 bg-visu-mint hover:bg-visu-mint/90 active:bg-visu-mint-dark text-slate-950 font-bold py-3.5 px-5 rounded-2xl text-sm transition-all shadow-md shadow-visu-mint/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Hallazgos Terminados: Pasar a Presupuesto</span>
                  <ChevronRight className="w-4 h-4 text-slate-950" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PASO 2: VALORIZACIÓN PRESUPUESTARIA (JEFE DE TALLER)         */}
      {/* ============================================================ */}
      {!loading && paso === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-3.5 text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-visu-mint" />
              <span className="font-semibold">Valorización de Reparación & Cotización</span>
            </div>
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="text-visu-mint hover:text-visu-mint-light text-xs font-bold underline cursor-pointer"
            >
              Editar Hallazgos
            </button>
          </div>

          {/* Lista de ítems a valorizar */}
          <div className="space-y-3">
            {hallazgos.map((item, index) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-visu-mint/20 text-visu-blue font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>

                  {item.url_foto && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url_foto}
                        alt="Miniatura hallazgo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {item.titulo || `Hallazgo #${index + 1}`}
                    </h3>
                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                      {item.descripcion || 'Sin descripción ingresada'}
                    </p>
                  </div>
                </div>

                {/* Input de Valor Neto */}
                <div className="sm:w-48 self-end sm:self-center">
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">
                    Valor Neto ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-600">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={item.valor_neto === 0 ? '' : item.valor_neto}
                      onChange={(e) =>
                        handleFieldChange(
                          item.id,
                          'valor_neto',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="0"
                      className="w-full pl-7 text-right font-mono font-bold text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ============================================================ */}
          {/* CUADRO DE LIQUIDACIÓN Y TOTALES EN TIEMPO REAL (IVA 19%)    */}
          {/* ============================================================ */}
          <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Resumen Presupuestario</span>
              <span className="text-[10px] font-bold text-visu-blue bg-visu-mint/20 border border-visu-mint/40 px-2 py-0.5 rounded">
                Valores en Pesos Chilenos
              </span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal Neto ({hallazgos.length} ítems):</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatearPesos(subtotalNeto)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>IVA (19%):</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatearPesos(iva19)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-sm text-slate-900 block">
                    Total a Pagar:
                  </span>
                  <span className="text-[10px] text-slate-600">IVA incluido</span>
                </div>
                <span className="text-xl font-black font-mono text-visu-blue">
                  {formatearPesos(totalGeneral)}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              ← Volver a Hallazgos
            </button>

            <button
              type="button"
              onClick={handleGuardarTodo}
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-visu-mint hover:bg-visu-mint/90 active:bg-visu-mint-dark text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-visu-mint/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Guardando Presupuesto...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-slate-950" />
                  <span>Guardar Hallazgos y Presupuesto</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
