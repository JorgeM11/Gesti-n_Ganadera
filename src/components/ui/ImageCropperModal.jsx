import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crop, 
  X, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  Maximize2
} from 'lucide-react';
import { getCroppedImg } from '@/lib/imageUtils';

const ASPECT_RATIOS = [
  { label: '4:3 (Ganado)', value: 4 / 3 },
  { label: '1:1 (Cuadrado)', value: 1 / 1 },
  { label: '16:9 (Panorámica)', value: 16 / 9 },
  { label: '3:4 (Vertical)', value: 3 / 4 },
];

export default function ImageCropperModal({
  isOpen = true,
  imageSrc,
  onClose,
  onCancel,
  onCropSave,
  onCropComplete,
  onUseOriginal,
  title = "Recortar y Encuadrar Fotografía"
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const croppedAreaPixelsRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  }, [onClose, onCancel]);

  const handleCropCompleteInternal = useCallback((croppedArea, pixels) => {
    croppedAreaPixelsRef.current = pixels;
    setCroppedAreaPixels(pixels);
  }, []);

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleConfirmCrop = async () => {
    const pixelsToCrop = croppedAreaPixels || croppedAreaPixelsRef.current;
    if (!pixelsToCrop || !imageSrc) {
      if (onUseOriginal) onUseOriginal();
      handleClose();
      return;
    }
    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(imageSrc, pixelsToCrop, rotation);
      if (onCropSave) {
        await onCropSave(croppedBlob);
      } else if (onCropComplete) {
        await onCropComplete(croppedBlob);
      }
      handleClose();
    } catch (err) {
      console.error('Error recortando imagen:', err);
      alert('Error al recortar la imagen. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeepOriginal = () => {
    if (onUseOriginal) {
      onUseOriginal();
    }
    handleClose();
  };

  if (!imageSrc || isOpen === false) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/90 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Crop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white leading-tight">
                  {title}
                </h3>
                <p className="text-[11px] font-medium text-neutral-400">
                  Arrastra para encuadrar o usa dos dedos / rueda para zoom
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Recorte (Canvas interactivo react-easy-crop) */}
          <div className="relative w-full h-80 sm:h-[420px] bg-neutral-950 overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropCompleteInternal}
              showGrid={true}
            />
          </div>

          {/* Controles de Recorte */}
          <div className="p-4 sm:p-5 bg-neutral-900/95 border-t border-neutral-800/80 space-y-3.5 shrink-0 text-white">
            {/* 1. Selector de Ratio de Aspecto */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400 shrink-0">
                Proporción:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = aspect === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setAspect(item.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Slider de Zoom y Botón de Rotar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-neutral-800/70 px-3 py-2 rounded-xl border border-neutral-700/60">
                <ZoomOut className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Nivel de zoom"
                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <ZoomIn className="w-4 h-4 text-neutral-400 shrink-0" />
              </div>

              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 border border-neutral-700/70 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Girar 90 grados"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">Girar 90°</span>
              </button>
            </div>

            {/* 3. Botones de Acción */}
            <div className="pt-1 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="py-3 px-3.5 sm:px-4 rounded-2xl border border-neutral-700 text-xs sm:text-sm font-bold text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleKeepOriginal}
                disabled={isProcessing}
                className="py-3 px-3.5 sm:px-4 rounded-2xl bg-neutral-800 border border-neutral-700 text-xs sm:text-sm font-bold text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer"
                title="Guardar la fotografía completa original sin recortar"
              >
                Sin recortar
              </button>

              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Recortando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Recortar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
