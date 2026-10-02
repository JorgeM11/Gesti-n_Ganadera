import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente que restablece el scroll al inicio (0, 0)
 * cada vez que cambia la ruta, los parámetros o la vista.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // 1. Scroll en window
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // 2. Scroll en elementos raíz del documento
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 3. Scroll en elementos contenedores principales si existieran
    const scrollContainers = document.querySelectorAll('main, #root, .mobile-shell-wrapper, .mobile-shell');
    scrollContainers.forEach(el => {
      if (el && typeof el.scrollTop === 'number') {
        el.scrollTop = 0;
      }
    });
  }, [pathname, search]);

  return null;
}
