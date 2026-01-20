import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Demo() {
  const [isEmbedReady, setIsEmbedReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const NAMESPACE = 'phraze-demo';
    const SCRIPT_SRC = 'https://app.cal.com/embed/embed.js';

    (function (C, A, L) {
      let p = function (a, ar) {
        a.q.push(ar);
      };
      let d = C.document;

      C.Cal =
        C.Cal ||
        function () {
          let cal = C.Cal;
          let ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement('script')).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () {
              p(api, arguments);
            };
            const namespace = ar[1];
            api.q = api.q || [];
            if (typeof namespace === 'string') {
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ['initNamespace', namespace]);
            } else p(cal, ar);
            return;
          }
          p(cal, ar);
        };
    })(window, SCRIPT_SRC, 'init');

    const initCal = () => {
      if (!window.Cal) return false;

      window.Cal('init', NAMESPACE, { origin: 'https://app.cal.com' });

      if (!window.Cal.ns || !window.Cal.ns[NAMESPACE]) return false;

      window.Cal.ns[NAMESPACE]('ui', {
        theme: 'light',
        hideEventTypeDetails: false,
        layout: 'month_view',
      });

      window.Cal.ns[NAMESPACE]('inline', {
        elementOrSelector: '#cal-embed',
        calLink: 'het-patel-bktsw5/phraze-demo',
      });

      return true;
    };

    if (initCal()) return;

    const id = window.setInterval(() => {
      if (initCal()) window.clearInterval(id);
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const host = document.getElementById('cal-embed');
    if (!host) return;

    const check = () => {
      if (host.querySelector('iframe')) {
        setIsEmbedReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });

    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {isEmbedReady && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium px-5 py-2 rounded-lg transition-all duration-300 bg-gray-100 hover:bg-gray-200 text-gray-900 border border-transparent inline-flex items-center gap-2 mb-10"
            style={{ fontFamily: 'Times New Roman, Times, serif' }}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <div
          id="cal-embed"
          className="w-full"
          style={{
            minHeight: '900px',
            opacity: isEmbedReady ? 1 : 0,
            transition: 'opacity 220ms ease',
          }}
        />
      </div>
    </div>
  );
}
