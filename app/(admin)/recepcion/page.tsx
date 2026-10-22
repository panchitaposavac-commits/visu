'use client';

import React, { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { registrarRecepcionVehiculo } from './actions';
import {
  Wrench,
  User,
  Car,
  Camera,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Printer,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  Gauge,
  Palette,
  Shield,
  Loader2,
  Eye,
  X,
  ImageIcon,
  ClipboardList,
  Mic,
  MicOff,
} from 'lucide-react';

// Declaraciones de tipos para Web Speech API
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
import {
  AREAS_EVIDENCIA,
  TIPO_SERVICIO_LABELS,
  type AreaEvidencia,
  type ClientFormData,
  type VehicleFormData,
  type DiagnosticFormData,
  type EvidenceFileState,
  type ReceptionActionResult,
  type TipoServicio,
} from '@/types/visu';

const OPCIONES_TIPO_SERVICIO: Array<{
  value: TipoServicio;
  label: string;
  description: string;
}> = [
  {
    value: 'mantencion',
    label: 'Mantención Preventiva',
    description: 'Pautas periódicas, cambios de aceite y filtros.',
  },
  {
    value: 'reparacion',
    label: 'Reparación Correctiva',
    description: 'Falla mecánica, ruido anómalo o avería específica.',
  },
];

// =========================================================================
// PASOS DEL WIZARD (CON TÍTULOS Y DESCRIPCIONES COMPACTAS - 5 PASOS)
// =========================================================================
const WIZARD_STEPS = [
  { step: 1, title: 'Tipo de Servicio y Motivo', short: 'Servicio', icon: Wrench, desc: 'Tipo de ingreso y requerimiento' },
  { step: 2, title: 'Datos del Cliente', short: 'Cliente', icon: User, desc: 'Identificación y contacto' },
  { step: 3, title: 'Datos del Vehículo', short: 'Vehículo', icon: Car, desc: 'Patente y kilometraje' },
  { step: 4, title: 'Evidencias Fotográficas', short: 'Fotos', icon: Camera, desc: '5 áreas de inspección' },
  { step: 5, title: 'Compromiso y Entrega', short: 'Entrega', icon: Calendar, desc: 'Plazos y confirmación final' },
];

export default function RecepcionWizardPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // ESTADOS DEL FORMULARIO
  // -----------------------------------------------------------------------
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticFormData>({
    tipo_servicio: 'mantencion',
    descripcion_cliente: '',
    fecha_estimada_entrega: '',
  });

  const [clientData, setClientData] = useState<ClientFormData>({
    rut_dni: '',
    nombre: '',
    apellido: '',
    correo: '',
    telefono: '',
  });

  const [vehicleData, setVehicleData] = useState<VehicleFormData>({
    patente: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear().toString(),
    kilometraje: '',
    color: '',
  });

  // Estado de las 5 áreas de fotos fijas
  const [evidences, setEvidences] = useState<Record<AreaEvidencia, EvidenceFileState>>({
    Frontal: { area: 'Frontal', file: null, previewUrl: null, uploadedUrl: null, isUploading: false, error: null },
    Capó: { area: 'Capó', file: null, previewUrl: null, uploadedUrl: null, isUploading: false, error: null },
    'Costado Izquierdo': { area: 'Costado Izquierdo', file: null, previewUrl: null, uploadedUrl: null, isUploading: false, error: null },
    'Costado Derecho': { area: 'Costado Derecho', file: null, previewUrl: null, uploadedUrl: null, isUploading: false, error: null },
    Llantas: { area: 'Llantas', file: null, previewUrl: null, uploadedUrl: null, isUploading: false, error: null },
  });

  // Modal para ver foto en grande
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; title: string } | null>(null);

  // Resultado de éxito al completar
  const [successResult, setSuccessResult] = useState<Extract<ReceptionActionResult, { success: true }> | null>(null);

  // Estado del Asistente de IA (Groq)
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Estado de Dictado por Voz (Web Speech API)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );
  });
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const textBeforeDictationRef = useRef<string>('');

  // Limpieza de reconocimiento de voz al desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Manejador de Dictado por Voz (Speech-to-Text)
  const handleToggleListening = () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionConstructor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setGlobalError('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API). Prueba en Chrome o Safari.');
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = 'es-CL';
      recognition.continuous = true;
      recognition.interimResults = true;

      // Guardamos el texto base que existía antes de iniciar este dictado
      textBeforeDictationRef.current = diagnosticData.descripcion_cliente;

      recognition.onstart = () => {
        setIsListening(true);
        if (globalError) setGlobalError(null);
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

        const combinedDictation = (finalTranscript + interimTranscript).trim();
        const base = textBeforeDictationRef.current.trim();
        const newText = base
          ? `${base} ${combinedDictation}`
          : combinedDictation;

        setDiagnosticData((prev) => ({
          ...prev,
          descripcion_cliente: newText,
        }));
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setGlobalError('Permiso de micrófono denegado. Permite el acceso al micrófono en los ajustes del navegador.');
        } else if (event.error !== 'no-speech') {
          setGlobalError(`Aviso de dictado: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      console.error('Error al iniciar SpeechRecognition:', err);
      setIsListening(false);
      setGlobalError('No se pudo activar el micrófono. Verifica los permisos del dispositivo.');
    }
  };

  // -----------------------------------------------------------------------
  // MANEJADORES DE ENTRADA
  // -----------------------------------------------------------------------
  const handleMejorarConIA = async () => {
    // Si estaba dictando, detenemos el micrófono antes de procesar con IA
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const rawText = diagnosticData.descripcion_cliente.trim();
    if (!rawText || isOptimizing) return;

    setIsOptimizing(true);
    setGlobalError(null);
    setAiSuccessMessage(null);

    try {
      const response = await fetch('/api/ordenar-diagnostico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texto: rawText,
          tipo_servicio: diagnosticData.tipo_servicio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con el servicio de IA.');
      }

      if (data.texto_ordenado) {
        setDiagnosticData((prev) => ({
          ...prev,
          descripcion_cliente: data.texto_ordenado,
        }));
        setAiSuccessMessage('Texto estructurado con éxito por IA.');
        setTimeout(() => setAiSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      console.error('Error al estructurar diagnóstico con IA:', err);
      const msg = err instanceof Error ? err.message : 'No se pudo optimizar el texto con IA.';
      setGlobalError(msg);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleDiagnosticChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setDiagnosticData((prev) => ({ ...prev, [name]: value }));
    if (globalError) setGlobalError(null);
  };

  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClientData((prev) => ({ ...prev, [name]: value }));
    if (globalError) setGlobalError(null);
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'patente') {
      setVehicleData((prev) => ({ ...prev, patente: value.toUpperCase().trim() }));
    } else {
      setVehicleData((prev) => ({ ...prev, [name]: value }));
    }
    if (globalError) setGlobalError(null);
  };

  const setQuickDelivery = (hoursToAdd: number) => {
    const targetDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = '00';
    setDiagnosticData((prev) => ({
      ...prev,
      fecha_estimada_entrega: `${year}-${month}-${day}T${hours}:${minutes}`,
    }));
  };

  // -----------------------------------------------------------------------
  // SUBIDA Y CAPTURA CON CÁMARA A SUPABASE STORAGE
  // -----------------------------------------------------------------------
  const cameraInputRefs = useRef<{ [key in AreaEvidencia]?: HTMLInputElement | null }>({});
  const galleryInputRefs = useRef<{ [key in AreaEvidencia]?: HTMLInputElement | null }>({});

  const handleFileSelect = async (area: AreaEvidencia, file: File) => {
    if (!file) return;

    // Vista previa instantánea
    const localPreview = URL.createObjectURL(file);

    setEvidences((prev) => ({
      ...prev,
      [area]: {
        ...prev[area],
        file,
        previewUrl: localPreview,
        isUploading: true,
        error: null,
      },
    }));

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanPatente = vehicleData.patente || 'SIN-PATENTE';
      const cleanArea = area.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const fileName = `recepcion/${cleanPatente}_${cleanArea}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('visu-evidencias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.warn(`Aviso en subida Storage (${area}):`, uploadError.message);
        setEvidences((prev) => ({
          ...prev,
          [area]: {
            ...prev[area],
            isUploading: false,
            uploadedUrl: localPreview,
            error: null,
          },
        }));
        return;
      }

      const { data: urlData } = supabase.storage
        .from('visu-evidencias')
        .getPublicUrl(uploadData.path);

      setEvidences((prev) => ({
        ...prev,
        [area]: {
          ...prev[area],
          isUploading: false,
          uploadedUrl: urlData.publicUrl || localPreview,
          error: null,
        },
      }));
    } catch (err: unknown) {
      console.error(`Error subiendo foto de ${area}:`, err);
      setEvidences((prev) => ({
        ...prev,
        [area]: {
          ...prev[area],
          isUploading: false,
          uploadedUrl: localPreview,
          error: null,
        },
      }));
    }
  };

  const handleRemovePhoto = (area: AreaEvidencia, e: React.MouseEvent) => {
    e.stopPropagation();
    setEvidences((prev) => ({
      ...prev,
      [area]: {
        area,
        file: null,
        previewUrl: null,
        uploadedUrl: null,
        isUploading: false,
        error: null,
      },
    }));
    if (cameraInputRefs.current[area]) cameraInputRefs.current[area]!.value = '';
    if (galleryInputRefs.current[area]) galleryInputRefs.current[area]!.value = '';
  };

  // -----------------------------------------------------------------------
  // VALIDACIONES POR PASO
  // -----------------------------------------------------------------------
  const validateStep = (step: number): boolean => {
    setGlobalError(null);

    // PASO 1: Tipo de servicio y motivo de ingreso
    if (step === 1) {
      if (!diagnosticData.tipo_servicio) {
        setGlobalError('Por favor selecciona el tipo de servicio (Mantención o Reparación).');
        return false;
      }
      if (!diagnosticData.descripcion_cliente.trim()) {
        setGlobalError('Ingresa una descripción del requerimiento o problema indicado por el cliente.');
        return false;
      }
      return true;
    }

    // PASO 2: Datos del cliente
    if (step === 2) {
      if (!clientData.rut_dni.trim()) {
        setGlobalError('Por favor ingresa el RUT o DNI del cliente.');
        return false;
      }
      if (!clientData.nombre.trim() || !clientData.apellido.trim()) {
        setGlobalError('Ingresa el nombre y apellido completos del cliente.');
        return false;
      }
      if (!clientData.correo.trim() || !clientData.correo.includes('@')) {
        setGlobalError('Ingresa un correo electrónico válido para enviar notificaciones.');
        return false;
      }
      if (!clientData.telefono.trim()) {
        setGlobalError('Ingresa un número de teléfono de contacto.');
        return false;
      }
      return true;
    }

    // PASO 3: Datos del vehículo
    if (step === 3) {
      if (!vehicleData.patente.trim() || vehicleData.patente.trim().length < 4) {
        setGlobalError('Ingresa una patente o matrícula válida.');
        return false;
      }
      if (!vehicleData.marca.trim() || !vehicleData.modelo.trim()) {
        setGlobalError('Especifica la marca y modelo del vehículo.');
        return false;
      }
      if (!vehicleData.kilometraje.trim() || isNaN(Number(vehicleData.kilometraje))) {
        setGlobalError('Ingresa un kilometraje numérico válido.');
        return false;
      }
      if (!vehicleData.color.trim()) {
        setGlobalError('Especifica el color del vehículo.');
        return false;
      }
      return true;
    }

    // PASO 4: Fotos (opcionales)
    if (step === 4) {
      return true;
    }

    // PASO 5: Fecha y compromiso de entrega
    if (step === 5) {
      if (!diagnosticData.fecha_estimada_entrega.trim()) {
        setGlobalError('Selecciona la fecha y hora estimada de entrega.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setGlobalError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -----------------------------------------------------------------------
  // ENVÍO FINAL MEDIANTE SERVER ACTION
  // -----------------------------------------------------------------------
  const handleSubmitFinal = () => {
    if (!validateStep(5)) return;

    const evidenciasParaEnviar = AREAS_EVIDENCIA.map((area) => {
      const item = evidences[area];
      const url = item.uploadedUrl || item.previewUrl;
      return url ? { area, url_archivo: url } : null;
    }).filter((ev): ev is { area: AreaEvidencia; url_archivo: string } => ev !== null);

    const payload = {
      cliente: clientData,
      vehiculo: {
        patente: vehicleData.patente,
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        anio: Number(vehicleData.anio) || new Date().getFullYear(),
        kilometraje: Number(vehicleData.kilometraje) || 0,
        color: vehicleData.color,
      },
      diagnostico: diagnosticData,
      evidencias: evidenciasParaEnviar,
    };

    startTransition(async () => {
      try {
        const result = await registrarRecepcionVehiculo(payload);

        if (result.success) {
          setSuccessResult(result);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setGlobalError(result.error || 'Ocurrió un error al guardar la recepción.');
        }
      } catch (err: unknown) {
        console.error('Error al ejecutar server action:', err);
        setGlobalError('Error de comunicación con el servidor. Revisa tu conexión.');
      }
    });
  };

  const totalFotosCargadas = Object.values(evidences).filter((e) => e.uploadedUrl || e.previewUrl).length;

  // Porcentaje de progreso lineal (20%, 40%, 60%, 80%, 100%)
  const progressPercent = (currentStep / 5) * 100;

  // =========================================================================
  // RENDER: PANTALLA DE ÉXITO (CONFIRMACIÓN & COMPROBANTE MOBILE-FIRST)
  // =========================================================================
  if (successResult) {
    const telRaw = successResult.data.cliente.telefono || '';
    let telClean = telRaw.replace(/\D/g, '');
    if (telClean.length === 9) {
      telClean = `56${telClean}`;
    } else if (telClean.length === 8) {
      telClean = `569${telClean}`;
    }

    const nombreCliente = successResult.data.cliente.nombreCompleto || 'Estimado(a) Cliente';
    const marcaModelo = successResult.data.vehiculo.vehiculoCompleto || 'Vehículo';
    const patente = successResult.data.vehiculo.patente || '';
    const numOT = String(successResult.numero_ot).startsWith('OT')
      ? successResult.numero_ot
      : `OT #${successResult.numero_ot}`;
    const ordenId = successResult.orden_id;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const urlOT = `${baseUrl}/ordenes/${ordenId}`;

    const mensajeWhatsApp = `Hola *${nombreCliente}*, confirmamos el ingreso de tu vehículo *${marcaModelo}* (Patente: *${patente}*) a taller Visú bajo la orden *${numOT}*. Puedes revisar el informe oficial de recepción, diagnóstico inicial y registro fotográfico en el siguiente enlace:\n\n${urlOT}`;

    const whatsappUrl = `https://wa.me/${telClean}?text=${encodeURIComponent(mensajeWhatsApp)}`;

    return (
      <div className="w-full max-w-2xl mx-auto py-2 sm:py-6 print:p-0 print:max-w-none">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-8 print:border-none print:shadow-none print:p-0 space-y-6">
          {/* Header de Éxito */}
          <div className="text-center pb-6 border-b border-slate-100">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200 shadow-xs print:hidden">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-visu-mint/20 text-visu-blue border border-visu-mint/40 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Ingreso Registrado con Éxito
            </span>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {successResult.numero_ot}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Vehículo en estado <strong className="text-slate-800 uppercase">Recibido</strong> en patio.
            </p>
          </div>

          {/* Resumen Ficha Técnica */}
          <div className="space-y-4">
            {/* Tarjeta Cliente & Vehículo */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-visu-blue" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Cliente</span>
                </div>
                <span className="font-bold text-sm text-slate-900">{successResult.data.cliente.nombreCompleto}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>RUT / Contacto:</span>
                <span className="font-medium text-slate-800">{successResult.data.cliente.rut_dni} • {successResult.data.cliente.telefono}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Correo de Aviso:</span>
                <span className="font-medium text-slate-800 truncate max-w-[200px]">{successResult.data.cliente.correo}</span>
              </div>
            </div>

            {/* Tarjeta Vehículo */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-visu-blue" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Vehículo</span>
                </div>
                <span className="font-extrabold text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded tracking-wider">
                  {successResult.data.vehiculo.patente}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Modelo:</span>
                <span className="font-semibold text-slate-800">{successResult.data.vehiculo.vehiculoCompleto}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Kilometraje / Color:</span>
                <span className="font-medium text-slate-800">{successResult.data.vehiculo.kilometraje.toLocaleString()} km • {successResult.data.vehiculo.color}</span>
              </div>
            </div>

            {/* Servicio y Compromiso */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Servicio</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-visu-mint/25 text-slate-900 border border-visu-mint/40">
                  {TIPO_SERVICIO_LABELS[successResult.data.orden.tipo_servicio] || successResult.data.orden.tipo_servicio}
                </span>
              </div>

              <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {successResult.data.orden.descripcion_cliente}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-visu-blue" />
                  <span>Entrega Estimada: <strong>{new Date(successResult.data.orden.fecha_estimada_entrega).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
                </div>
                <span className="text-slate-600 font-medium">📸 {successResult.data.totalEvidencias} evidencias guardadas</span>
              </div>
            </div>
          </div>

          {/* Botones Móviles Táctiles Full Width */}
          <div className="pt-2 flex flex-col gap-3 print:hidden">
            {/* Botón Principal Destacado: Enviar informe a Cliente por WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-semibold py-4 px-6 rounded-2xl text-base shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer text-center"
            >
              <svg className="w-6 h-6 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>Enviar informe a Cliente por WhatsApp</span>
            </a>

            {/* Fila de Botones Secundarios */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/ordenes/${successResult.orden_id}`}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir</span>
              </Link>

              <Link
                href="/ordenes"
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors shadow-2xs cursor-pointer"
              >
                <span>Ver Tablero</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: WIZARD DE RECEPCIÓN MOBILE-FIRST
  // =========================================================================
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. BARRA DE PROGRESO LINEAL COMPACTA & ENCABEZADO MÓVIL       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
        {/* Título & Badge de Paso */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-visu-blue text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {currentStep}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {WIZARD_STEPS[currentStep - 1].title}
              </h1>
              <p className="text-[11px] text-slate-600 hidden sm:block">
                {WIZARD_STEPS[currentStep - 1].desc}
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-visu-blue bg-visu-mint/20 border border-visu-mint/40 px-2.5 py-1 rounded-lg shrink-0">
            Paso {currentStep} de 5
          </span>
        </div>

        {/* Barra de progreso lineal */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
          <div
            className="bg-visu-mint h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Pastillas de navegación táctil compactas (5 pasos) */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 text-center">
          {WIZARD_STEPS.map((stepItem) => {
            const isCompleted = currentStep > stepItem.step;
            const isCurrent = currentStep === stepItem.step;

            return (
              <button
                key={stepItem.step}
                type="button"
                onClick={() => {
                  if (stepItem.step < currentStep) {
                    setCurrentStep(stepItem.step);
                    setGlobalError(null);
                  }
                }}
                disabled={stepItem.step > currentStep}
                className={`py-1 px-0.5 sm:px-1 rounded-lg text-[10px] sm:text-xs font-semibold truncate transition-colors ${
                  isCurrent
                    ? 'bg-visu-blue text-white shadow-2xs'
                    : isCompleted
                    ? 'bg-visu-mint/20 text-visu-blue font-bold hover:bg-visu-mint/30'
                    : 'text-slate-600 opacity-60 cursor-not-allowed'
                }`}
              >
                {stepItem.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerta de Error Global */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-red-800 animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm font-medium">
            <p className="font-bold text-red-900 mb-0.5">Dato requerido</p>
            <p>{globalError}</p>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-red-400 hover:text-red-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. CUERPO DEL PASO ACTUAL (OPTIMIZADO PARA PANTALLA TÁCTIL)    */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs">
        {/* ========================================================= */}
        {/* PASO 1: TIPO DE SERVICIO Y MOTIVO DE INGRESO (NUEVO INICIO) */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-visu-blue" />
                <span>Tipo de Servicio y Motivo de Ingreso</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Especifica la modalidad del trabajo a realizar y el requerimiento reportado por el cliente.
              </p>
            </div>

            {/* Selector Visual de Tipo de Servicio */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Selecciona el Tipo de Servicio <span className="text-visu-blue font-bold">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OPCIONES_TIPO_SERVICIO.map((opcion) => {
                  const isSelected = diagnosticData.tipo_servicio === opcion.value;
                  return (
                    <div
                      key={opcion.value}
                      onClick={() => setDiagnosticData((prev) => ({ ...prev, tipo_servicio: opcion.value }))}
                      className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-3 active:scale-[0.99] ${
                        isSelected
                          ? 'border-visu-mint bg-visu-mint/10 ring-2 ring-visu-mint/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-visu-mint bg-visu-mint' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>}
                      </div>

                      <div>
                        <p className="font-bold text-sm text-slate-900">{opcion.label}</p>
                        <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                          {opcion.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Descripción / Motivo de Ingreso */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Descripción del Requerimiento / Síntomas <span className="text-visu-blue font-bold">*</span>
                </label>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Botón Dictado por Voz (Web Speech API) */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={handleToggleListening}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-2xs active:scale-[0.98] ${
                        isListening
                          ? 'bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-300 ring-2 ring-red-400/20 font-semibold animate-pulse'
                          : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                      }`}
                      title={isListening ? 'Detener dictado por voz' : 'Dictar por voz los síntomas del vehículo'}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-600" />
                          <span>Escuchando...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-slate-600" />
                          <span>Dictar</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Botón Asistente IA */}
                  <button
                    type="button"
                    onClick={handleMejorarConIA}
                    disabled={!diagnosticData.descripcion_cliente.trim() || isOptimizing || isListening}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-visu-blue bg-visu-mint/20 hover:bg-visu-mint/30 active:bg-visu-mint/40 border border-visu-mint/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs active:scale-[0.98]"
                    title="Estructurar redacción técnica con Inteligencia Artificial"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-visu-blue" />
                        <span>Optimizando...</span>
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

              {/* Mensaje sutil de éxito de la IA */}
              {aiSuccessMessage && (
                <div className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{aiSuccessMessage}</span>
                </div>
              )}

              <textarea
                name="descripcion_cliente"
                value={diagnosticData.descripcion_cliente}
                onChange={handleDiagnosticChange}
                rows={4}
                placeholder="Indica con detalle lo reportado por el cliente o síntomas (puedes escribir o usar el botón Dictar)..."
                className="w-full px-3.5 py-2.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                required
              />
              <p className="text-[11px] text-slate-600 mt-1">
                Detalla ruidos, pautas de kilometraje solicitadas o anomalías mencionadas por el conductor.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 2: DATOS DEL CLIENTE                                 */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-visu-blue" />
                <span>Identificación y Contacto del Cliente</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Información para el envío de presupuestos, comprobante y trazabilidad.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* RUT / DNI */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  RUT / DNI <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="rut_dni"
                    value={clientData.rut_dni}
                    onChange={handleClientChange}
                    placeholder="Ej: 12.345.678-9"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                    required
                  />
                  <Shield className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nombre <span className="text-visu-blue font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={clientData.nombre}
                  onChange={handleClientChange}
                  placeholder="Ej: Carlos"
                  autoComplete="given-name"
                  className="w-full px-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Apellido <span className="text-visu-blue font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="apellido"
                  value={clientData.apellido}
                  onChange={handleClientChange}
                  placeholder="Ej: Morales"
                  autoComplete="family-name"
                  className="w-full px-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
              </div>

              {/* Teléfono / WhatsApp */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Teléfono / Celular <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    name="telefono"
                    value={clientData.telefono}
                    onChange={handleClientChange}
                    placeholder="+56 9 1234 5678"
                    autoComplete="tel"
                    className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                    required
                  />
                  <Phone className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Correo Electrónico <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    inputMode="email"
                    name="correo"
                    value={clientData.correo}
                    onChange={handleClientChange}
                    placeholder="cliente@ejemplo.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                    required
                  />
                  <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 3: DATOS DEL VEHÍCULO                                */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-visu-blue" />
                <span>Ficha Técnica de la Unidad</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Ingresa la patente y características del vehículo recibido en taller.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Patente / Matrícula */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Patente / Matrícula <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="patente"
                    value={vehicleData.patente}
                    onChange={handleVehicleChange}
                    placeholder="ABCD12"
                    maxLength={10}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    className="w-full pl-10 pr-3.5 text-lg sm:text-base font-extrabold uppercase tracking-widest text-slate-900 rounded-xl"
                    required
                  />
                  <Car className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>

              {/* Marca */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Marca <span className="text-visu-blue font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="marca"
                  value={vehicleData.marca}
                  onChange={handleVehicleChange}
                  placeholder="Ej: Toyota"
                  className="w-full px-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
              </div>

              {/* Modelo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Modelo <span className="text-visu-blue font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="modelo"
                  value={vehicleData.modelo}
                  onChange={handleVehicleChange}
                  placeholder="Ej: RAV4"
                  className="w-full px-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
              </div>

              {/* Kilometraje */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Kilometraje <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    name="kilometraje"
                    value={vehicleData.kilometraje}
                    onChange={handleVehicleChange}
                    placeholder="85000"
                    min={0}
                    className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                    required
                  />
                  <Gauge className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>

              {/* Año */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Año <span className="text-visu-blue font-bold">*</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  name="anio"
                  value={vehicleData.anio}
                  onChange={handleVehicleChange}
                  min={1980}
                  max={new Date().getFullYear() + 1}
                  className="w-full px-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Color <span className="text-visu-blue font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="color"
                    value={vehicleData.color}
                    onChange={handleVehicleChange}
                    placeholder="Gris Plata"
                    className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                    required
                  />
                  <Palette className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 4: EVIDENCIAS FOTOGRÁFICAS INICIALES (MOBILE CAMERA) */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-visu-blue" />
                  <span>Evidencias Fotográficas Iniciales</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Toma fotos en terreno para respaldar el estado exterior y detalles de ingreso.
                </p>
              </div>

              <span className="text-xs font-bold bg-visu-mint/20 text-visu-blue px-2.5 py-1 rounded-full border border-visu-mint/40 shrink-0">
                {totalFotosCargadas}/5
              </span>
            </div>

            {/* Grid 1 Columna en Smartphone / 2 Columnas en Tablet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {AREAS_EVIDENCIA.map((area) => {
                const evidenceState = evidences[area];
                const hasPhoto = Boolean(evidenceState.previewUrl || evidenceState.uploadedUrl);

                return (
                  <div
                    key={area}
                    className={`rounded-2xl border-2 transition-all p-3.5 flex flex-col justify-between ${
                      hasPhoto
                        ? 'border-visu-mint bg-visu-mint/5 shadow-xs'
                        : 'border-dashed border-2 border-visu-mint/60 hover:border-visu-mint bg-visu-mint/5 hover:bg-visu-mint/10'
                    }`}
                  >
                    {/* Header de la Tarjeta */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {hasPhoto ? (
                          <CheckCircle2 className="w-4 h-4 text-visu-blue" />
                        ) : (
                          <Camera className="w-4 h-4 text-slate-600" />
                        )}
                        <span>{area}</span>
                      </span>

                      {hasPhoto && (
                        <span className="text-[10px] font-bold bg-visu-mint text-slate-950 px-2 py-0.5 rounded-full shadow-2xs">
                          Cargada
                        </span>
                      )}
                    </div>

                    {/* Inputs Ocultos: Uno con Cámara Directa y otro para Galería */}
                    <input
                      ref={(el) => {
                        cameraInputRefs.current[area] = el;
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(area, file);
                      }}
                    />

                    <input
                      ref={(el) => {
                        galleryInputRefs.current[area] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(area, file);
                      }}
                    />

                    {/* Vista Previa o Botones Táctiles de Carga */}
                    {hasPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={evidenceState.previewUrl || evidenceState.uploadedUrl || ''}
                          alt={`Evidencia ${area}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Botones de acción táctiles ampliados */}
                        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModalImg({
                                url: evidenceState.previewUrl || evidenceState.uploadedUrl || '',
                                title: `Evidencia: ${area}`,
                              })
                            }
                            className="w-11 h-11 rounded-xl bg-white text-slate-900 shadow-md flex items-center justify-center active:scale-95 transition-transform"
                            title="Ver ampliada"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => cameraInputRefs.current[area]?.click()}
                            className="w-11 h-11 rounded-xl bg-white text-visu-blue shadow-md flex items-center justify-center active:scale-95 transition-transform hover:text-visu-mint-dark"
                            title="Tomar otra foto"
                          >
                            <Camera className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleRemovePhoto(area, e)}
                            className="w-11 h-11 rounded-xl bg-red-600 text-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {evidenceState.isUploading && (
                          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center gap-2 text-white text-xs font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin text-visu-mint" />
                            <span>Guardando en nube...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Botón Principal: Abrir Cámara del Celular Directa */}
                        <button
                          type="button"
                          onClick={() => cameraInputRefs.current[area]?.click()}
                          className="min-h-[50px] w-full rounded-xl bg-visu-mint hover:bg-visu-mint/90 active:bg-visu-mint-dark text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-slate-950" />
                          <span>Tomar Foto con Cámara</span>
                        </button>

                        {/* Botón Secundario: Subir desde Galería de Archivos */}
                        <button
                          type="button"
                          onClick={() => galleryInputRefs.current[area]?.click()}
                          className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white hover:bg-visu-mint/10 active:bg-visu-mint/20 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                          <span>O seleccionar de Galería</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 5: FECHA Y COMPROMISO DE ENTREGA (PASO FINAL)        */}
        {/* ========================================================= */}
        {currentStep === 5 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-visu-blue" />
                <span>Compromiso y Fecha Estimada de Entrega</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Define los plazos acordados con el cliente y confirma los antecedentes para generar la OT.
              </p>
            </div>

            {/* Selector de Fecha y Hora Estimada de Entrega */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Fecha y Hora Estimada de Entrega <span className="text-visu-blue font-bold">*</span>
                </label>
                {/* Atajos Rápidos */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-600 text-[11px]">Atajos:</span>
                  <button
                    type="button"
                    onClick={() => setQuickDelivery(4)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-visu-mint/20 active:bg-visu-mint/30 text-slate-700 hover:text-visu-blue font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    +4h
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDelivery(24)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-visu-mint/20 active:bg-visu-mint/30 text-slate-700 hover:text-visu-blue font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDelivery(48)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-visu-mint/20 active:bg-visu-mint/30 text-slate-700 hover:text-visu-blue font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    48h
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="datetime-local"
                  name="fecha_estimada_entrega"
                  value={diagnosticData.fecha_estimada_entrega}
                  onChange={handleDiagnosticChange}
                  className="w-full pl-10 pr-3.5 text-base sm:text-sm font-medium text-slate-900 rounded-xl"
                  required
                />
                <Calendar className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5 sm:top-3" />
              </div>
            </div>

            {/* Resumen Compacto de Confirmación Previo al Envío */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider pb-1.5 border-b border-slate-200/70">
                <ClipboardList className="w-3.5 h-3.5 text-visu-blue" />
                <span>Resumen de la Orden a Registrar</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Servicio Seleccionado:</span>
                <span className="font-bold text-visu-blue bg-visu-mint/20 border border-visu-mint/40 px-2 py-0.5 rounded text-[11px]">
                  {TIPO_SERVICIO_LABELS[diagnosticData.tipo_servicio]}
                </span>
              </div>

              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-600 shrink-0">Motivo / Síntoma:</span>
                <span className="font-medium text-slate-800 text-right line-clamp-2">
                  {diagnosticData.descripcion_cliente || '(Sin descripción)'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Cliente / Contacto:</span>
                <span className="font-semibold text-slate-800">
                  {clientData.nombre} {clientData.apellido} ({clientData.rut_dni}) • {clientData.telefono}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Vehículo:</span>
                <span className="font-semibold text-slate-800">
                  {vehicleData.patente} • {vehicleData.marca} {vehicleData.modelo} ({vehicleData.color})
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
                <span className="text-slate-600">Evidencias Adjuntas:</span>
                <span className="font-bold text-visu-blue bg-visu-mint/20 px-2 py-0.5 rounded text-[11px]">
                  📸 {totalFotosCargadas} de 5 fotografías guardadas
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 3. BOTONES DE ACCIÓN TÁCTIL (MOBILE-FIRST)                    */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-5 mt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          {/* Botón Anterior */}
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isPending}
              className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm transition-colors shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Paso Anterior</span>
            </button>
          ) : (
            <div className="hidden sm:block"></div>
          )}

          {/* Botón Siguiente o Guardar (Ancho completo en móvil para fácil pulsación) */}
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="w-full sm:w-auto min-h-[50px] flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-visu-mint hover:bg-visu-mint/90 active:bg-visu-mint-dark text-slate-950 font-bold text-base transition-all shadow-md shadow-visu-mint/20 active:scale-[0.99] cursor-pointer"
            >
              <span>Continuar a {WIZARD_STEPS[currentStep].title}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitFinal}
              disabled={isPending}
              className="w-full sm:w-auto min-h-[52px] flex items-center justify-center gap-2 px-10 py-3 rounded-xl bg-visu-mint hover:bg-visu-mint/90 active:bg-visu-mint-dark text-slate-950 font-bold text-base transition-all shadow-md shadow-visu-mint/30 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>Generando Orden de Trabajo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>Finalizar y Generar OT</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODAL LIGHTBOX PARA VER FOTO AMPLIADA EN CELULAR            */}
      {/* ============================================================= */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in"
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            className="relative max-w-xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 text-white flex items-center justify-between border-b border-slate-800">
              <span className="font-bold text-xs sm:text-sm">{previewModalImg.title}</span>
              <button
                onClick={() => setPreviewModalImg(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalImg.url}
                alt={previewModalImg.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
