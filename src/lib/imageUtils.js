import { supabase } from '@/lib/supabaseClient';

/**
 * Comprime una imagen localmente usando el Canvas del navegador.
 * Redimensiona a un ancho máximo de 800px manteniendo el ratio de aspecto
 * y aplica una compresión JPEG al 70% de calidad.
 * 
 * @param {File | Blob} file El archivo original (File o Blob) capturado por el input
 * @returns {Promise<Blob>} Promesa que resuelve a un nuevo Blob comprimido
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = /** @type {string} */ (event.target?.result);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        
        // Calcular el nuevo tamaño manteniendo la proporción
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }

        // Dibujar la imagen redimensionada en el canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Exportar a Blob con formato JPEG y 70% de calidad (0.7)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Fallo al comprimir la imagen en el canvas'));
            }
          },
          'image/jpeg',
          0.7
        );
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen original para comprimir'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo original'));
    };
  });
}

/**
 * Sube un Blob (imagen comprimida) a Supabase Storage y retorna la URL pública.
 * 
 * @param {Blob} blob El archivo binario a subir
 * @param {string} fileName El nombre del archivo (ej: 'evento-204-16982348') sin la extensión
 * @param {string} [bucketName='ganadera_images'] El nombre del bucket en Supabase
 * @returns {Promise<string>} La URL pública de la imagen
 */
export async function uploadImageToSupabase(
  blob, 
  fileName, 
  bucketName = 'ganadera_images'
) {
  
  const fullFileName = `${fileName}.jpg`;

  // 1. Subir la imagen al bucket
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fullFileName, blob, {
      contentType: 'image/jpeg',
      upsert: true // Si el archivo ya existe con ese nombre, lo sobreescribe
    });

  if (uploadError) {
    console.error('[Storage] Error subiendo imagen:', uploadError);
    throw uploadError;
  }

  // 2. Obtener la URL pública generada
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fullFileName);

  return `${publicUrlData.publicUrl}?t=${Date.now()}`;
}

/**
 * Carga una imagen en un elemento HTMLImageElement
 * @param {string} url 
 * @returns {Promise<HTMLImageElement>}
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => {
      console.error('[createImage] Error al cargar imagen:', error);
      reject(error);
    });
    if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
      const cacheBustUrl = url.includes('?') ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`;
      image.src = cacheBustUrl;
    } else {
      image.src = url;
    }
  });

export function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Retorna las dimensiones de la caja envolvente de una imagen rotada
 */
export function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Genera un Blob recortado y rotado a partir de las coordenadas del cropper
 * @param {string} imageSrc URL o DataURL de la imagen original
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop Coordenadas del recorte
 * @param {number} rotation Ángulo de rotación en grados
 * @returns {Promise<Blob>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo obtener el contexto 2D del canvas');
  }

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('No se pudo obtener el contexto del canvas de recorte');
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Fallo al generar el Blob recortado'));
      }
    }, 'image/jpeg', 0.95);
  });
}
