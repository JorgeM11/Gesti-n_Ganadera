import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SyncManager from '@/components/providers/SyncManager';
import ScrollToTop from '@/components/providers/ScrollToTop';

// Importaremos las páginas
import Login from './pages/Login';
import Inventario from './pages/Inventario';
import NuevoAnimal from './pages/NuevoAnimal';
import PerfilAnimal from './pages/PerfilAnimal';
import PerfilEvento from './pages/PerfilEvento';
import PerfilServicio from './pages/PerfilServicio';
import PerfilTacto from './pages/PerfilTacto';
import PerfilTratamiento from './pages/PerfilTratamiento';
import TratamientoLote from './pages/TratamientoLote';

function ProtectedRoute({ children }) {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Restablecimiento de scroll al inicio en cada cambio de ruta/parámetros */}
      <ScrollToTop />

      {/* Manejador de sincronización en segundo plano */}
      <SyncManager />

      <Routes>
        {/* Redirección por defecto: Si entras a la raíz, vas al Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
        <Route path="/inventario/nuevo" element={<ProtectedRoute><NuevoAnimal /></ProtectedRoute>} />
        <Route path="/inventario/perfil" element={<ProtectedRoute><PerfilAnimal /></ProtectedRoute>} />
        <Route path="/inventario/perfil/evento" element={<ProtectedRoute><PerfilEvento /></ProtectedRoute>} />
        <Route path="/inventario/perfil/servicio" element={<ProtectedRoute><PerfilServicio /></ProtectedRoute>} />
        <Route path="/inventario/perfil/tacto" element={<ProtectedRoute><PerfilTacto /></ProtectedRoute>} />
        <Route path="/inventario/perfil/tratamiento" element={<ProtectedRoute><PerfilTratamiento /></ProtectedRoute>} />
        <Route path="/inventario/tratamiento-lote" element={<ProtectedRoute><TratamientoLote /></ProtectedRoute>} />

        {/* Ruta 404: Por seguridad, redirigimos al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}