/**
 * Utilidades genéticas para razas bovinas, pureza y cálculo de mestizaje.
 */

export const POPULAR_BREEDS = [
  'Brahman',
  'Gyr',
  'Guzerá',
  'Nelore',
  'Carora',
  'Holstein',
  'Jersey',
  'Pardo Suizo',
  'Angus',
  'Brangus',
  'Simmental',
  'Senepol',
  'Criollo Limonero',
  'Charolais',
  'Mestizo'
];

/**
 * Normaliza la composición genética de un animal a un mapa porcentual { [raza]: porcentaje }
 */
export function getNormalizedComposition(animal) {
  if (!animal) return {};

  if (animal.breed_composition && typeof animal.breed_composition === 'object' && Object.keys(animal.breed_composition).length > 0) {
    return { ...animal.breed_composition };
  }

  const breed = animal.breed || 'Mestizo';
  const purity = Number(animal.purity_percentage ?? (breed === 'Mestizo' ? 50 : 100));

  if (breed === 'Mestizo') {
    return { Mestizo: 100 };
  }

  const composition = { [breed]: purity };
  if (purity < 100) {
    composition['Mestizo'] = Number((100 - purity).toFixed(2));
  }
  return composition;
}

/**
 * Calcula la genética resultante de una cría a partir del padre y la madre.
 * Regla biológica: cada progenitor aporta el 50% (factor 0.5) de su patrimonio genético.
 * 
 * @param {Object} father - Datos del padre ({ breed, purity_percentage, breed_composition })
 * @param {Object} mother - Datos de la madre ({ breed, purity_percentage, breed_composition })
 * @returns {{ breed: string, purity_percentage: number, breed_composition: Record<string, number>, label: string }}
 */
export function calculateOffspringGenetics(father, mother) {
  // Caso 1: Progenitores no definidos
  if (!father && !mother) {
    return {
      breed: 'Mestizo',
      purity_percentage: 50,
      breed_composition: { Mestizo: 100 },
      label: 'Mestizo (50%)'
    };
  }

  // Caso 2: Solo un progenitor conocido
  if (!father || !mother) {
    const known = father || mother;
    const knownComp = getNormalizedComposition(known);
    const offspringComp = {};

    for (const [raza, pct] of Object.entries(knownComp)) {
      offspringComp[raza] = Number((pct * 0.5).toFixed(2));
    }
    offspringComp['Mestizo'] = Number(((offspringComp['Mestizo'] || 0) + 50).toFixed(2));

    const primaryBreed = known.breed && known.breed !== 'Mestizo' ? known.breed : 'Mestizo';
    const purity = offspringComp[primaryBreed] || 50;

    return {
      breed: purity >= 90 ? primaryBreed : 'Mestizo',
      purity_percentage: Math.round(purity),
      breed_composition: offspringComp,
      label: formatGeneticsLabel('Mestizo', purity, offspringComp)
    };
  }

  // Caso 3: Ambos progenitores conocidos
  const fatherComp = getNormalizedComposition(father);
  const motherComp = getNormalizedComposition(mother);
  const offspringComp = {};

  // Aporte 50% padre
  for (const [raza, pct] of Object.entries(fatherComp)) {
    offspringComp[raza] = (offspringComp[raza] || 0) + (pct * 0.5);
  }

  // Aporte 50% madre
  for (const [raza, pct] of Object.entries(motherComp)) {
    offspringComp[raza] = (offspringComp[raza] || 0) + (pct * 0.5);
  }

  // Redondear a 2 decimales
  for (const raza of Object.keys(offspringComp)) {
    offspringComp[raza] = Number(offspringComp[raza].toFixed(2));
  }

  // Identificar razas ordenadas por predominancia
  const sortedBreeds = Object.entries(offspringComp)
    .filter(([raza]) => raza !== 'Mestizo' && offspringComp[raza] > 0)
    .sort((a, b) => b[1] - a[1]);

  // Si ambos son de la misma raza pura (ej. Brahman 100% + Brahman 100% = Brahman 100%)
  if (sortedBreeds.length === 1) {
    const [soleBreed, pct] = sortedBreeds[0];
    const purity = Math.round(pct);
    const finalBreed = purity >= 90 ? soleBreed : 'Mestizo';
    return {
      breed: finalBreed,
      purity_percentage: purity,
      breed_composition: offspringComp,
      label: `${finalBreed} (${purity}%)`
    };
  }

  // Si hay más de una raza específica en la mezcla
  if (sortedBreeds.length >= 2) {
    const [breedA, pctA] = sortedBreeds[0];
    const [breedB, pctB] = sortedBreeds[1];

    // F1 exacto de dos razas puras
    const isF1 = Math.abs(pctA - 50) < 1 && Math.abs(pctB - 50) < 1;
    const label = isF1 
      ? `F1 (${Math.round(pctA)}% ${breedA} - ${Math.round(pctB)}% ${breedB})`
      : `Mestizo (${Math.round(pctA)}% ${breedA}, ${Math.round(pctB)}% ${breedB})`;

    return {
      breed: 'Mestizo',
      purity_percentage: Math.round(pctA), // El porcentaje de la raza dominante
      breed_composition: offspringComp,
      label
    };
  }

  // Todo mestizo
  return {
    breed: 'Mestizo',
    purity_percentage: 50,
    breed_composition: { Mestizo: 100 },
    label: 'Mestizo'
  };
}

/**
 * Formatea una etiqueta legible del estado genético
 */
export function formatGeneticsLabel(breed, purity, composition) {
  if (breed && breed !== 'Mestizo' && purity >= 90) {
    return `${breed} Puro (${Math.round(purity)}%)`;
  }
  if (composition && typeof composition === 'object') {
    const nonMestizo = Object.entries(composition)
      .filter(([b, p]) => b !== 'Mestizo' && p > 0)
      .sort((a, b) => b[1] - a[1]);

    if (nonMestizo.length >= 2) {
      return `Mestizo (${Math.round(nonMestizo[0][1])}% ${nonMestizo[0][0]} / ${Math.round(nonMestizo[1][1])}% ${nonMestizo[1][0]})`;
    }
    if (nonMestizo.length === 1) {
      return `Mestizo (${Math.round(nonMestizo[0][1])}% ${nonMestizo[0][0]})`;
    }
  }
  return breed ? `${breed} (${Math.round(purity || 50)}%)` : 'Mestizo';
}
