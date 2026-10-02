import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, List, TrendingUp, ShieldPlus, Share2, Loader2, Milk } from 'lucide-react';
import { FaVenusMars } from 'react-icons/fa6';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

// Importación de Módulos (Tabs)
import DetailsTab from '@/components/DetailsTab';
import EvolutionTab from '@/components/EvolutionTab';
import HealthTab from '@/components/HealthTab';
import GenealogyTab from '@/components/GenealogyTab';
import ReproductionTab from '@/components/ReproductionTab';
import MilkingTab from '@/components/MilkingTab';

// UI Components
import BottomSheet from '@/components/ui/BottomSheet';
import AnimalForm from '@/components/inventario/AnimalForm';
import { AnimatePresence, motion } from 'framer-motion';

function ProfileContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  // CAPTURAMOS EL ID Y EL TAB DIRECTAMENTE DE LA URL (?id=...&tab=...)
  const animalId = searchParams.get("id"); 
  const initialTab = searchParams.get("tab") || 'details';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [setSearchParams]);

  // --- SISTEMA DE MODAL RECURSIVO (idéntico a NuevoAnimal.jsx) ---
  const [modalStack, setModalStack] = useState([]);

  const handleOpenModal = useCallback((sex, onSelect) => {
    setModalStack(prev => [...prev, { id: crypto.randomUUID(), sex, onSelect }]);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1));
  }, []);

  const handleModalSuccess = useCallback((newAnimalId) => {
    setModalStack(prev => {
      if (prev.length === 0) return prev;
      const currentModal = prev[prev.length - 1];
      if (currentModal && typeof currentModal.onSelect === 'function') {
        currentModal.onSelect(newAnimalId);
      }
      return prev.slice(0, -1);
    });
  }, []);
  // ------------------------------------------------

  // Consulta reactiva a Dexie usando el ID de la URL
  const animal = useLiveQuery(() => {
    if (animalId) return db.animals.get(animalId);
    return null;
  }, [animalId]);

  // Sincronizar el tab si cambia en la URL o si el animal cambia y la pestaña no aplica a su sexo
  useEffect(() => {
    const tab = searchParams.get("tab") || 'details';
    if (animal && animal.sex !== 'Hembra' && (tab === 'reproduction' || tab === 'milking')) {
      setActiveTab('details');
    } else {
      setActiveTab(tab);
    }
  }, [searchParams, animal]);

  // Restablecer scroll al inicio siempre que cambie de pestaña o de animal
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeTab, animalId]);

  // Mientras carga el animal inicial o si no hay ID en la URL
  if (animal === undefined || !animalId) {
    return (
      <div className="min-h-screen bg-[#F7F7F2] flex flex-col items-center justify-center text-[#1B4820]">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold uppercase tracking-widest text-xs opacity-60">Cargando Ficha...</p>
      </div>
    );
  }

  // Si el animal no existe en Dexie
  if (animal === null) {
    return (
      <div className="min-h-screen bg-[#F7F7F2] flex flex-col items-center justify-center text-[#1B4820] px-6 text-center">
        <h2 className="text-2xl font-black mb-2">Animal no encontrado</h2>
        <p className="text-sm text-neutral-500 mb-6 font-medium">El registro que buscas no existe o fue eliminado.</p>
        <Link to="/inventario" className="bg-[#1B4820] text-white px-8 py-3 rounded-full font-bold text-sm">
          VOLVER AL INVENTARIO
        </Link>
      </div>
    );
  }

  const navItems = [
    { id: 'details', label: 'Detalles', icon: List },
    { id: 'evolution', label: 'Evolución', icon: TrendingUp },
    { id: 'health', label: 'Salud', icon: ShieldPlus },
  ];

  if (animal.sex === 'Hembra') {
    navItems.push({ id: 'reproduction', label: 'Reproducción', icon: FaVenusMars });
    navItems.push({ id: 'milking', label: 'Ordeño', icon: Milk });
  }

  navItems.push({ id: 'genealogy', label: 'Genealogía', icon: Share2 });

  return (
    <main className="min-h-screen bg-[#F7F7F2] font-sans pb-24 md:pb-8 relative">
      {/* HEADER FIJO */}
      <header className="bg-[#F7F7F2] px-4 py-4 sticky top-0 z-30 flex items-center gap-4 border-b border-neutral-100 md:border-none">
        <Link to="/inventario" className="p-2 -ml-2 hover:bg-neutral-200 rounded-full transition-colors cursor-pointer">
          <ArrowLeft className="w-6 h-6 text-[#1B4820]" />
        </Link>
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1 
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="text-xl font-bold text-[#1B4820]"
            >
              {activeTab === 'details' ? 'Ficha del Animal' :
                activeTab === 'evolution' ? 'Evolución del Animal' :
                  activeTab === 'health' ? 'Carnet de Salud' :
                    activeTab === 'reproduction' ? 'Registro Reproductivo' :
                      activeTab === 'milking' ? 'Control de Ordeño' : 'Genealogía'}
            </motion.h1>
          </AnimatePresence>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        {/* NAVEGACIÓN DESKTOP */}
        <nav className="hidden md:flex items-center justify-center gap-4 border-b border-neutral-200 mb-6 px-4 sticky top-[72px] bg-[#F7F7F2]/95 backdrop-blur-xs z-20 pt-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative flex items-center cursor-pointer gap-2 pb-3.5 pt-1 px-4 transition-colors font-bold uppercase tracking-widest text-xs ${
                  isActive ? 'text-[#1B4820]' : 'text-neutral-400 hover:text-[#1B4820]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="desktopTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1B4820] rounded-full shadow-[0_1px_4px_rgba(27,72,32,0.3)]"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* CONTENIDO DINÁMICO */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            >
              {activeTab === 'details' && <DetailsTab animal={animal} onEdit={() => setIsEditModalOpen(true)} />}
              {activeTab === 'evolution' && <EvolutionTab animal={animal} />}
              {activeTab === 'health' && <HealthTab animal={animal} />}
              {activeTab === 'reproduction' && <ReproductionTab animal={animal} />}
              {activeTab === 'milking' && <MilkingTab animal={animal} />}
              {activeTab === 'genealogy' && <GenealogyTab animal={animal} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* BOTTOM NAV (Móvil) */}
      <nav className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-neutral-200 px-3 py-2 md:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative flex flex-col items-center gap-1 flex-1 py-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#1B4820]' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileTabIndicator"
                    className="absolute -top-2 w-7 h-1 bg-[#1B4820] rounded-full shadow-[0_1px_4px_rgba(27,72,32,0.3)]"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <motion.div
                  animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                </motion.div>
                <span className={`text-[8px] uppercase tracking-wider text-center whitespace-nowrap transition-all ${
                  isActive ? 'font-black text-[#1B4820]' : 'font-semibold text-neutral-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MODAL DE EDICIÓN */}
      <BottomSheet
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Animal"
        description={`Actualiza la información de #${animal.number}`}
      >
        <AnimalForm 
          isModal
          initialValues={animal}
          onCancel={() => setIsEditModalOpen(false)}
          onSubmitSuccess={() => setIsEditModalOpen(false)}
          onOpenModal={handleOpenModal}
        />
      </BottomSheet>

      {/* MODALES RECURSIVOS PARA CREAR PADRES */}
      <AnimatePresence>
        {modalStack.map((modal, index) => (
          <BottomSheet
            key={modal.id}
            isOpen={true}
            onClose={handleCloseModal}
            title={`Registrar ${modal.sex === 'Macho' ? 'Padre' : 'Madre'}`}
            description="Completa los datos mínimos para identificar al progenitor."
            style={{ zIndex: 60 + index * 10 }}
          >
            <AnimalForm 
              isModal
              initialValues={{ sex: modal.sex }}
              onCancel={handleCloseModal}
              onSubmitSuccess={handleModalSuccess}
              onOpenModal={handleOpenModal}
            />
          </BottomSheet>
        ))}
      </AnimatePresence>
    </main>
  );
}

export default function AnimalProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F7F2] flex flex-col items-center justify-center text-[#1B4820]">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold uppercase tracking-widest text-xs opacity-60">Cargando...</p>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
