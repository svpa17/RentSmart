// RentSmart — poza unui anunț: miniatură cu dimensiuni fixe, colțuri rotunjite, object-fit: cover.
// Doar URL-uri https validate; fără referrer (unele CDN-uri refuză altfel); încărcare leneșă.
// Dacă poza lipsește sau nu se încarcă: un înlocuitor neutru, iar anunțul rămâne vizibil.
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { safeImageUrl } from '../content/structured.js';

export default function PropertyImage({ src, alt = '', className = 'h-20 w-24', children }) {
  const url = safeImageUrl(src);
  const [failed, setFailed] = useState(null);
  const broken = !url || failed === url;
  return (
    <div className={`relative flex-none overflow-hidden rounded-[12px] bg-fill ${className}`}>
      {broken ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-subtle" role="img" aria-label="Imagine indisponibilă">
          <Building2 size={22} strokeWidth={1.6} aria-hidden="true" />
          <span className="text-[10px] font-medium">Fără imagine</span>
        </div>
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(url)}
        />
      )}
      {children}
    </div>
  );
}
