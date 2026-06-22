// Highlights an element on the current page that matches text from the AI assistant
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const AiHighlightWatcher = () => {
  const location = useLocation();

  useEffect(() => {
    const apply = () => {
      const term = sessionStorage.getItem('ai_highlight');
      if (!term) return;

      // Try several attempts in case page is still loading
      let attempts = 0;
      const tryHighlight = () => {
        attempts++;
        const needle = term.trim().toLowerCase();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        let found: HTMLElement | null = null;
        while ((node = walker.nextNode())) {
          const text = node.textContent?.toLowerCase() || '';
          if (text.includes(needle) && node.parentElement) {
            const el = node.parentElement.closest('tr, .card, [role="row"], li, div') as HTMLElement;
            if (el && el.offsetHeight > 0) { found = el; break; }
          }
        }

        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          found.style.transition = 'all 0.5s';
          const original = found.style.boxShadow;
          found.style.boxShadow = '0 0 0 3px hsl(195 100% 50%), 0 0 40px hsl(330 85% 65% / 0.6)';
          found.style.borderRadius = '8px';
          setTimeout(() => { found!.style.boxShadow = original; }, 4000);
          sessionStorage.removeItem('ai_highlight');
        } else if (attempts < 8) {
          setTimeout(tryHighlight, 400);
        } else {
          sessionStorage.removeItem('ai_highlight');
        }
      };

      setTimeout(tryHighlight, 500);
    };

    apply();
    const handler = () => apply();
    window.addEventListener('ai-highlight', handler);
    return () => window.removeEventListener('ai-highlight', handler);
  }, [location.pathname]);

  return null;
};
