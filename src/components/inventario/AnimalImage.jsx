import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function AnimalImage({
  photoPath,
  photoBlob,
  alt,
  className = "",
  sex = "Hembra",
  birthDate = null,
  animalId = null
}) {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgError, setImgError] = useState(false);

  // Consulta por ID único si se proporciona y no hay foto directa
  const dbAnimal = useLiveQuery(async () => {
    if (!animalId || photoBlob || photoPath) return null;
    return await db.animals.get(animalId);
  }, [animalId, photoBlob, photoPath]);

  // Prioridad local (Blob físico en IndexedDB antes que URL en la nube)
  useEffect(() => {
    setImgError(false);
    let objectUrl = null;

    const effectiveBlob = photoBlob || dbAnimal?.photo_blob || null;
    const effectivePath = photoPath || dbAnimal?.photo_path || null;

    if (effectiveBlob) {
      objectUrl = URL.createObjectURL(effectiveBlob);
      setImgSrc(objectUrl);
    } else if (effectivePath) {
      setImgSrc(effectivePath);
    } else {
      setImgSrc(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoPath, photoBlob, dbAnimal?.photo_blob, dbAnimal?.photo_path]);

  // Lógica de silueta según sexo y edad
  const finalSex = dbAnimal?.sex || sex;
  const finalBirthDate = dbAnimal?.birth_date || birthDate;
  let isBecerro = false;

  if (finalBirthDate) {
    const months = (new Date() - new Date(finalBirthDate)) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 12) isBecerro = true;
  } else if (alt && (alt.toLowerCase().includes('nacer') || alt.toLowerCase().includes('destete'))) {
    isBecerro = true;
  }

  let placeholderSrc = '/placeholders/vaca.png';
  if (isBecerro) {
    placeholderSrc = '/placeholders/becerro.png';
  } else if (finalSex === 'Macho') {
    placeholderSrc = '/placeholders/toro.png';
  }

  // Renderizado
  if (!imgSrc || imgError) {
    return (
      <div className={`flex items-center justify-center bg-[#E5E7EB] w-full h-full ${className}`}>
        <img
          src={placeholderSrc}
          alt="Silueta"
          className="w-full h-full p-[18%] object-contain opacity-50 mix-blend-multiply drop-shadow-sm transition-all"
        />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt || "Animal"}
      className={`object-cover w-full h-full ${className}`}
      onError={() => setImgError(true)}
    />
  );
}
