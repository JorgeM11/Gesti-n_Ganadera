import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SyncManager from '@/components/providers/SyncManager';
import ScrollToTop from '@/components/providers/ScrollToTop';

// Importaremos las páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventario from './pages/Inventario';
import NuevoAnimal from './pages/NuevoAnimal';
import PerfilAnimal from './pages/PerfilAnimal';
import PerfilEvento from './pages/PerfilEvento';
import PerfilTratamiento from './pages/PerfilTratamiento';
import Vaquerias from './pages/Vaquerias';
import VaqueriaDetalle from './pages/VaqueriaDetalle';

import { isCurrentUserWorker } from '@/lib/authService';

function ProtectedRoute({ children }) {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminOnlyRoute({ children }) {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  if (isCurrentUserWorker()) {
    return <Navigate to="/inventario" replace />;
  }
  return children;
}

function DefaultRedirect() {
  const userId = localStorage.getItem('ganadera_user_id');
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  if (isCurrentUserWorker()) {
    return <Navigate to="/inventario" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Restablecimiento de scroll al inicio en cada cambio de ruta/parámetros */}
      <ScrollToTop />

      {/* Manejador de sincronización en segundo plano */}
      <SyncManager />

      <Routes>
        {/* Redirección por defecto según rol */}
        <Route path="/" element={<DefaultRedirect />} />

        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route path="/dashboard" element={<AdminOnlyRoute><Dashboard /></AdminOnlyRoute>} />
        <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
        <Route path="/inventario/nuevo" element={<ProtectedRoute><NuevoAnimal /></ProtectedRoute>} />
        <Route path="/inventario/perfil" element={<ProtectedRoute><PerfilAnimal /></ProtectedRoute>} />
        <Route path="/inventario/perfil/evento" element={<ProtectedRoute><PerfilEvento /></ProtectedRoute>} />
        <Route path="/inventario/perfil/tratamiento" element={<ProtectedRoute><PerfilTratamiento /></ProtectedRoute>} />
        <Route path="/vaquerias" element={<AdminOnlyRoute><Vaquerias /></AdminOnlyRoute>} />
        <Route path="/vaquerias/:id" element={<AdminOnlyRoute><VaqueriaDetalle /></AdminOnlyRoute>} />

        {/* Ruta 404: Redirigir por defecto según rol */}
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}