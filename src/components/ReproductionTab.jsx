import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { GiCow } from 'react-icons/gi';
import { FaVenusMars } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

import PartosTab from './reproduction/PartosTab';
import TactosTab from './reproduction/TactosTab';
import ServiciosTab from './reproduction/ServiciosTab';

export default function ReproductionTab({ animal }) {
  const [activeSubTab, setActiveSubTab] = useState('partos');
  const animalId = animal?.id;

  // Conteo reactivo de crías nacidas
  const offspringCount = useLiveQuery(
    () => db.animals
      .where('mother_id').equals(animalId)
      .and(a => !a.deleted_at)
      .count(),
    [animalId]
  ) ?? 0;

  // Consulta reactiva de palpaciones y diagnóstico más reciente
  const checks = useLiveQuery(
    () => db.pregnancy_checks
      .where('animal_id').equals(animalId)
      .and(c => !c.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => b.check_date.localeCompare(a.check_date))),
    [animalId]
  ) || [];

  // Consulta reactiva de servicios
  const services = useLiveQuery(
    () => db.services
      .where('mother_id').equals(animalId)
      .and(s => !s.deleted_at)
      .toArray()
      .then(res => res.sort((a, b) => b.service_date.localeCompare(a.service_date))),
    [animalId]
  ) || [];



  const handleSubTabChange = (tabId) => {
    setActiveSubTab(tabId);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const subTabs = [
    { id: 'partos', label: 'Partos', count: offspringCount, icon: GiCow },
    { id: 'tactos', label: 'Palpación', count: checks.length, icon: Stethoscope },
    { id: 'servicios', label: 'Servicios', count: services.length, icon: FaVenusMars },
  ];

  if (!animal) return null;

  return (
    <div className="max-w-3xl mx-auto py-2 pb-24 relative">
      
      {/* 1. TÍTULO DE SECCIÓN Y ACCIONES */}
      <div className="mb-6 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF7EE] text-[#1B4820] rounded-2xl border border-[#1B4820]/10 shadow-2xs">
            <FaVenusMars className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-[#1B4820] leading-tight">Registro Reproductivo</h2>
            <p className="text-xs text-neutral-400 font-medium">Control de reproducción</p>
          </div>
        </div>
        <div className="bg-[#EEF7EE] px-3.5 py-1.5 rounded-2xl text-[#1B4820] font-black text-base border border-[#1B4820]/10 shadow-2xs">
          #{animal.number}
        </div>
      </div>

      {/* 2. SUB-NAVEGACIÓN PILLS */}
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:justify-center sm:gap-2 mb-6 max-w-lg mx-auto w-full px-1">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => handleSubTabChange(tab.id)}
              className={`relative flex items-center cursor-pointer justify-center gap-1 sm:gap-2 px-1.5 py-2 sm:px-4 sm:py-2.5 rounded-full font-bold text-[9.5px] sm:text-xs uppercase tracking-tight sm:tracking-wider transition-colors select-none active:scale-95 w-full sm:w-auto ${
                isActive
                  ? 'text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="reproductionSubTabActive"
                  className="absolute inset-0 bg-[#1B4820] rounded-full shadow-md shadow-[#1B4820]/20 -z-0"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2 min-w-0">
                <Icon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {tab.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. VISTAS DINÁMICAS */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            {activeSubTab === 'partos' && <PartosTab animalId={animalId} animal={animal} />}
            {activeSubTab === 'tactos' && <TactosTab animal={animal} />}
            {activeSubTab === 'servicios' && <ServiciosTab animal={animal} />}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
