// RentSmart — Crossroads compact în panoul lateral: drumul anunțului curent + „Planul”.
import { useMemo } from 'react';
import { CloudLightning, LayoutDashboard } from 'lucide-react';
import { costContext, trueCostOf } from '../app/derive.js';
import { EMPTY_USER_COSTS } from '../storage/appData.js';
import { Button, DemoBadge, Notice, Pill } from '../ui/components.jsx';
import { INCOMPLETE_MESSAGES, formatRON } from '../ui/format.js';
import Crossroads from './Crossroads.jsx';
import { buildCrossroads, negativeLabel, pathStatus } from './model.js';

const openDashboard = () => chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });

export default function CompactCrossroads({ data, analiza }) {
  const model = useMemo(() => {
    const ctx = costContext(data);
    if (!ctx) return { status: 'fara-passport' };
    const savedTwin = data.saved.find((s) => s.analiza.id === analiza.id);
    const current = savedTwin ? { ...savedTwin, analiza } : { analiza, costuriUtilizator: { ...EMPTY_USER_COSTS }, salvatLa: analiza.sursa.analizatLa };
    const others = data.saved.filter((s) => s.analiza.id !== analiza.id).map((s) => ({ saved: s, tc: trueCostOf(s, ctx) }));
    const items = [{ saved: current, tc: trueCostOf(current, ctx) }, ...others];
    if (!items[0].tc?.complet) return { status: 'incomplet', motive: items[0].tc?.motiveIncomplet ?? [] };
    return buildCrossroads({ ctx, items, simSettings: { ...data.simSettings, drumuri: [analiza.id] }, storms: data.storms });
  }, [data, analiza]);

  if (model.status === 'fara-passport') {
    return (
      <div className="space-y-2">
        <Notice tone="warn">Completează profilul financiar ca să vezi cum evoluează economiile.</Notice>
        <Button variant="secondary" className="w-full" icon={LayoutDashboard} onClick={openDashboard}>
          Deschide dashboard-ul
        </Button>
      </div>
    );
  }
  if (model.status === 'incomplet') {
    return (
      <div className="space-y-2">
        {model.motive.map((m) => (
          <Notice key={m} tone="warn">
            {INCOMPLETE_MESSAGES[m] ?? m}
          </Notice>
        ))}
      </div>
    );
  }
  const p = model.paths[0];
  const ind = p.drum.indicatori;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(analiza.demonstrativ || data.settings.modDemo) && <DemoBadge />}
        <Pill tone={pathStatus(ind).tone}>
          {pathStatus(ind).text}
          {ind.sigur ? ` · ${model.sim.luni} luni` : ''}
        </Pill>
        {data.storms.length > 0 && (
          <Pill tone="unclear" dot={false}>
            <CloudLightning size={12} aria-hidden="true" /> {data.storms.length} {data.storms.length === 1 ? 'situație neprevăzută' : 'situații neprevăzute'}
          </Pill>
        )}
      </div>
      <Crossroads model={model} lunaStart={data.simSettings.lunaStart} prag={model.sim.pragSigur} storms={data.storms} compact />
      {ind.primaLunaNegativa !== null && (
        <Notice tone="warn">
          {negativeLabel(data.simSettings.lunaStart, ind.primaLunaNegativa, model.xLuni)}. În cea mai grea lună îți lipsesc {formatRON(Math.max(0, -ind.soldMinim))}.
        </Notice>
      )}
      {model.plan && (
        <Notice>
          <strong>Ce poți face:</strong> {model.plan.text.titlu}. {model.plan.text.detaliu}
        </Notice>
      )}
      <Button variant="secondary" className="w-full" icon={LayoutDashboard} onClick={openDashboard}>
        Vezi toate lunile și ce poți schimba
      </Button>
    </div>
  );
}
