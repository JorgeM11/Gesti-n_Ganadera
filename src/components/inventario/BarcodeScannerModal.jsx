import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScanBarcode, Flashlight, FlashlightOff, SwitchCamera, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * BarcodeScannerModal:
 * Modal especializado para escanear códigos de barras de microchips / RFID con la cámara del dispositivo.
 * Optimizado exclusivamente para lectura de códigos de barras lineales 1D (Code 128, Code 39, EAN, UPC, ITF).
 * 
 * @param {boolean} isOpen - Controla visibilidad del modal
 * @param {function} onClose - Callback al cerrar/cancelar
 * @param {function} onScanSuccess - Callback que recibe el string escaneado
 */
export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [selectedFacingMode, setSelectedFacingMode] = useState('environment');
  const [lastScannedCode, setLastScannedCode] = useState(null);

  const scannerRef = useRef(null);
  const isStoppingRef = useRef(false);
  const containerId = 'ganadera-barcode-scanner-view';

  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  onScanSuccessRef.current = onScanSuccess;
  onCloseRef.current = onClose;

  const camerasRef = useRef([]);

  // Sonido sintético de escaneo exitoso (880Hz Beep)
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio no permitido o silenciado
    }
  }, []);

  // Vibración háptica en móvil
  const triggerVibrate = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(120);
      }
    } catch {
      // Ignorar si no está disponible
    }
  }, []);

  // Detener el escáner de forma limpia
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }
    } catch (err) {
      console.warn('Error al detener escáner:', err);
    } finally {
      scannerRef.current = null;
      isStoppingRef.current = false;
      setIsTorchOn(false);
      setHasTorch(false);
    }
  }, []);

  // Manejo de código detectado (estable, sin dependencias volátiles)
  const handleDecoded = useCallback(async (decodedText) => {
    if (!decodedText || isStoppingRef.current) return;
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    // Feedback inmediato
    setLastScannedCode(cleanCode);
    playBeep();
    triggerVibrate();

    // Detener escáner y entregar resultado
    await stopScanner();
    if (onScanSuccessRef.current) {
      onScanSuccessRef.current(cleanCode);
    }
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  }, [playBeep, triggerVibrate, stopScanner]);

  // Inspeccionar capacidades de la cámara (linterna)
  const checkTorchCapability = useCallback(() => {
    try {
      const videoEl = document.querySelector(`#${containerId} video`);
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (track) {
        const capabilities = track.getCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
          return;
        }
      }
    } catch {
      // Ignorar si el navegador no expone getCapabilities
    }
    setHasTorch(false);
  }, []);

  // Alternar linterna / flash
  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector(`#${containerId} video`);
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (track) {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn('No se pudo activar la linterna:', err);
    }
  };

  // Alternar entre cámaras trasera / delantera
  const handleSwitchCamera = async () => {
    let currentCams = camerasRef.current.length > 0 ? camerasRef.current : cameras;
    if (!currentCams || currentCams.length <= 1) {
      try {
        const fetched = await Html5Qrcode.getCameras();
        if (Array.isArray(fetched) && fetched.length > 0) {
          currentCams = fetched;
          camerasRef.current = fetched;
          setCameras(fetched);
        }
      } catch (e) {
        console.warn('Error consultando cámaras:', e);
      }
    }

    await stopScanner();

    // Si tenemos lista de cámaras con nombres/etiquetas
    if (currentCams && currentCams.length > 1) {
      const isCurrentlyFront = selectedFacingMode === 'user';
      const targetOppositeCam = currentCams.find(c => {
        const l = (c.label || '').toLowerCase();
        if (isCurrentlyFront) {
          return l.includes('back') || l.includes('rear') || l.includes('trasera') || l.includes('trasero') || l.includes('environment');
        } else {
          return l.includes('front') || l.includes('delantera') || l.includes('user') || l.includes('anterior');
        }
      });

      if (targetOppositeCam) {
        const targetIdx = currentCams.indexOf(targetOppositeCam);
        setSelectedCameraIndex(targetIdx);
        setSelectedFacingMode(isCurrentlyFront ? 'environment' : 'user');
        startScanning(targetOppositeCam.id);
      } else {
        const nextIndex = (selectedCameraIndex + 1) % currentCams.length;
        setSelectedCameraIndex(nextIndex);
        startScanning(currentCams[nextIndex].id);
      }
    } else {
      // Alternar directamente por facingMode nativo
      const nextFacing = selectedFacingMode === 'environment' ? 'user' : 'environment';
      setSelectedFacingMode(nextFacing);
      startScanning({ facingMode: nextFacing });
    }
  };

  // Iniciar el escaneo con Html5Qrcode
  const startScanning = useCallback(async (preferredCameraOrConfig = null) => {
    setIsInitializing(true);
    setCameraError('');
    setLastScannedCode(null);

    try {
      // Verificar soporte de getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no admite acceso a la cámara.');
      }

      // Crear instancia de Html5Qrcode con formatos optimizados
      const html5Qr = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
      scannerRef.current = html5Qr;

      // 1. Obtener lista de cámaras si ya están disponibles
      let currentCams = camerasRef.current;
      if (!currentCams || currentCams.length === 0) {
        try {
          const list = await Html5Qrcode.getCameras();
          if (Array.isArray(list) && list.length > 0) {
            currentCams = list;
            camerasRef.current = list;
            setCameras(list);
          }
        } catch {
          // Normal si no hay permisos previos
        }
      }

      // 2. Determinar configuración de cámara (siempre trasera por defecto en móviles y tablets)
      let cameraConfig;
      if (preferredCameraOrConfig) {
        cameraConfig = preferredCameraOrConfig;
      } else if (currentCams && currentCams.length > 0) {
        // Encontrar la cámara trasera en la lista de dispositivos
        const rearCamera = currentCams.find(c => {
          const l = (c.label || '').toLowerCase();
          return l.includes('back') || 
                 l.includes('rear') || 
                 l.includes('trasera') || 
                 l.includes('trasero') || 
                 l.includes('environment');
        });

        if (rearCamera) {
          const idx = currentCams.indexOf(rearCamera);
          setSelectedCameraIndex(idx !== -1 ? idx : 0);
          cameraConfig = rearCamera.id;
        } else {
          cameraConfig = { facingMode: 'environment' };
        }
      } else {
        cameraConfig = { facingMode: 'environment' };
      }

      // Configuración de escaneo a 20 FPS con visor apaisado para chips
      // NOTA: NO incluir videoConstraints aquí porque html5-qrcode ignora cameraIdOrConfig si se especifican
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.min(Math.floor(viewfinderWidth * 0.88), 340);
          const height = Math.min(Math.floor(viewfinderHeight * 0.42), 160);
          return { width, height };
        },
        aspectRatio: 1.0
      };

      try {
        await html5Qr.start(
          cameraConfig,
          config,
          (decodedText) => {
            handleDecoded(decodedText);
          },
          () => {}
        );
      } catch (startErr) {
        // Si falló con ID específico, reintentar con facingMode: environment
        if (typeof cameraConfig === 'string') {
          console.warn('Reintentando con facingMode: environment...', startErr);
          await html5Qr.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => handleDecoded(decodedText),
            () => {}
          );
        } else {
          throw startErr;
        }
      }

      setIsInitializing(false);

      // Enumerar cámaras post-permiso para asegurar nombres de etiquetas y habilitar cambio de cámara
      try {
        const postPermCams = await Html5Qrcode.getCameras();
        if (Array.isArray(postPermCams) && postPermCams.length > 0) {
          camerasRef.current = postPermCams;
          setCameras(postPermCams);
          if (!preferredCameraOrConfig) {
            const rearIdx = postPermCams.findIndex(c => {
              const l = (c.label || '').toLowerCase();
              return l.includes('back') || l.includes('rear') || l.includes('trasera') || l.includes('trasero') || l.includes('environment');
            });
            if (rearIdx !== -1) {
              setSelectedCameraIndex(rearIdx);
            }
          }
        }
      } catch (e) {
        console.warn('Error listando cámaras post-permiso:', e);
      }

      // Inspeccionar linterna de inmediato
      setTimeout(() => {
        checkTorchCapability();
      }, 250);

    } catch (err) {
      console.error('Error al iniciar escáner de código de barras:', err);
      let userMsg = 'No se pudo acceder a la cámara.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg = 'Permiso denegado. Permite el acceso a la cámara en los ajustes de tu navegador para escanear el chip.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = 'No se detectó ninguna cámara disponible en tu dispositivo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMsg = 'La cámara está siendo utilizada por otra aplicación.';
      } else if (err.message) {
        userMsg = err.message;
      }
      setCameraError(userMsg);
      setIsInitializing(false);
    }
  }, [handleDecoded, checkTorchCapability]);

  // Efecto de ciclo de vida del modal: se ejecuta ÚNICAMENTE al abrir o cerrar
  useEffect(() => {
    if (isOpen) {
      startScanning();
      return () => {
        stopScanner();
      };
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
          {/* Fondo oscuro con difuminado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={onClose}
          />

          {/* Tarjeta del Escáner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 text-white flex flex-col space-y-4"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ScanBarcode className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-neutral-100 truncate">
                    Escanear Código de Barras
                  </h3>
                  <p className="text-xs text-neutral-400 truncate">
                    Microchip RFID o arete del animal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white cursor-pointer"
                title="Cerrar escáner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenedor de la Cámara */}
            <div className="relative w-full aspect-square sm:aspect-4/3 bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
              {/* Elemento donde html5-qrcode inyecta el video */}
              <div 
                id={containerId} 
                className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
              />

              {/* Texto de instrucción posicionado más abajo */}
              {!cameraError && !isInitializing && !lastScannedCode && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10 px-4">
                  <p className="text-[11px] font-medium text-neutral-200 bg-black/75 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-neutral-700/60 shadow-lg text-center">
                    Apunta la barra al centro del recuadro
                  </p>
                </div>
              )}

              {/* Pantalla de carga */}
              {isInitializing && (
                <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center text-center p-4 space-y-3 z-10">
                  <div className="w-9 h-9 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-neutral-300">Iniciando cámara...</p>
                </div>
              )}

              {/* Mensaje de Código Escaneado con Éxito */}
              {lastScannedCode && (
                <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 space-y-2 z-20">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <h4 className="text-sm font-bold text-white">¡Código Escaneado!</h4>
                  <p className="text-xs font-mono font-bold text-emerald-300 bg-black/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                    {lastScannedCode}
                  </p>
                </div>
              )}

              {/* Mensaje de Error de Cámara */}
              {cameraError && (
                <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-neutral-200">Acceso a cámara requerido</h4>
                  <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => startScanning()}
                    className="mt-2 inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                </div>
              )}

              {/* Botones Flotantes de Control (Linterna y Cambiar Cámara) */}
              {!cameraError && !isInitializing && (
                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                        isTorchOn
                          ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-md shadow-amber-400/20'
                          : 'bg-black/60 text-white border-white/10 hover:bg-black/80'
                      }`}
                      title={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
                    >
                      {isTorchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="p-2.5 rounded-xl bg-black/60 text-white border border-white/10 hover:bg-black/80 backdrop-blur-md transition-all cursor-pointer"
                    title="Cambiar cámara (delantera / trasera)"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Pie / Acciones */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-neutral-800 hover:bg-neutral-700 active:scale-[0.99] text-neutral-200 text-xs font-bold py-3.5 rounded-2xl transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
