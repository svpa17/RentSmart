// RentSmart — secțiunea Crossroads din dashboard: comenzi, grafic, Path to Yes, indicatori, furtuni.
import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, Gauge, Route, SlidersHorizontal, Sparkles } from 'lucide-react';
import { checkHealth } from '../ai/client.js';
import { SIMULATION_ASSUMPTIONS } from '../shared/contracts/constants.js';
import { Card, DemoBadge, EmptyState, Notice, PageHeader, Pill } from '../ui/components.jsx';
import { INCOMPLETE_MESSAGES, formatRON } from '../ui/format.js';
import Controls from './Controls.jsx';
import Crossroads from './Crossroads.jsx';
import { buildCrossroads, negativeLabel, pathName, pathStatus } from './model.js';
import { monthLabel } from './scales.js';
import StormsPanel from './StormsPanel.jsx';

function PathToYesCard({ model, planChoice, onChoose }) {
  return (
    <div className="space-y-3">
      {model.paths.map((p) =>
        p.pathToYes.sigurDeja ? (
          <Notice key={p.listingId} tone="ok">
            <strong>Varianta {p.eticheta}:</strong> {p.pathToYes.mesaj}
          </Notice>
        ) : (
          <Card key={p.listingId} title={`Cum poți face chiria accesibilă · varianta ${p.eticheta}`} icon={Sparkles} description="Fiecare variantă de mai jos, singură, ar fi suficientă. Le-am calculat pe toate.">
            <p className="mb-3 text-[14px] text-ink">{p.pathToYes.mesaj}</p>
            <div className="space-y-2">
              {p.optiuni.map((o, i) => {
                const active = model.plan?.listingId === p.listingId && model.plan.index === i;
                return (
                  <button
                    key={`${o.tip}-${i}`}
                    type="button"
                    onClick={() => onChoose({ listingId: p.listingId, index: i })}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-[12px] border p-3 text-left ${active ? 'border-blue bg-brand-soft' : 'border-line bg-white hover:bg-fill'}`}
                    aria-pressed={active}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{o.text.titlu}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">{o.text.detaliu}</span>
                    </span>
                    {active && <CircleCheck size={18} className="mt-0.5 flex-none text-blue" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {planChoice === null && <p className="mt-3 text-[12px] text-muted">Prima variantă apare pe grafic ca linie verde punctată („Dacă urmezi recomandarea RentSmart”). Alege alta ca s-o vezi în locul ei.</p>}
          </Card>
        ),
      )}
    </div>
  );
}

function Indicators({ model, lunaStart, prag }) {
  const luni = model.xLuni;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[14px]">
        <thead className="border-b border-line bg-[#fbfbfd]">
          <tr className="text-left text-[12px] font-semibold tracking-wide text-muted uppercase">
            <th className="px-4 py-3">Varianta</th>
            <th className="px-4 py-3">Situația</th>
            <th className="px-4 py-3 text-right">Cei mai puțini bani</th>
            <th className="px-4 py-3 text-right">La final</th>
            <th className="px-4 py-3 text-right">Strângi până la mutare</th>
            <th className="px-4 py-3 text-right">La mutare, fără prima chirie</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {model.paths.map((p) => {
            const ind = p.drum.indicatori;
            return (
              <tr key={p.listingId} className="align-top">
                <td className="px-4 py-3.5 text-ink">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {pathName(p)}
                </td>
                <td className="px-4 py-3.5">
                  <Pill tone={pathStatus(ind).tone}>{pathStatus(ind).text}</Pill>
                  {ind.primaLunaNegativa !== null && <div className="mt-1 text-[12px] text-ask">{negativeLabel(lunaStart, ind.primaLunaNegativa, luni)}.</div>}
                  {ind.primaLunaNegativa === null && ind.primaLunaSubRezerva !== null && (
                    <div className="mt-1 text-[12px] text-unclear">
                      Din {monthLabel(lunaStart, ind.primaLunaSubRezerva, { luni })}, economiile scad sub suma păstrată pentru urgențe ({formatRON(prag)}).
                    </div>
                  )}
                </td>
                <td className={`num px-4 py-3.5 text-right whitespace-nowrap ${ind.soldMinim < 0 ? 'font-semibold text-ask' : 'text-ink'}`}>
                  {formatRON(ind.soldMinim)}
                  <div className="text-[12px] font-normal text-muted">în {monthLabel(lunaStart, ind.lunaSoldMinim, { luni })}</div>
                </td>
                <td className="num px-4 py-3.5 text-right whitespace-nowrap text-ink">{formatRON(ind.soldFinal)}</td>
                <td className="num px-4 py-3.5 text-right whitespace-nowrap text-ink">{formatRON(ind.economiiPanaLaMutare)}</td>
                <td className="num px-4 py-3.5 text-right whitespace-nowrap text-ink">{formatRON(p.plataLaMutare)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CrossroadsSection({ data, derived }) {
  const [planChoice, setPlanChoice] = useState(null);
  const [health, setHealth] = useState(null);
  const { simSettings, storms, passport, settings } = data;

  useEffect(() => {
    if (settings.modDemo) return;
    let alive = true;
    checkHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, [settings.modDemo]);

  const model = useMemo(
    () => buildCrossroads({ ctx: derived.ctx, items: derived.items, simSettings, storms, planChoice }),
    [derived, simSettings, storms, planChoice],
  );
  const completeItems = derived.items.filter((i) => i.tc?.complet);

  const header = (
    <PageHeader title="Cum evoluează economiile tale" description="Vezi lună de lună câți bani ți-ar rămâne cu fiecare apartament salvat, ce se întâmplă dacă apare ceva neprevăzut și ce poți schimba ca să-ți permiți chiria." />
  );
  if (model.status === 'fara-passport')
    return (
      <div>
        {header}
        <Card>
          <EmptyState icon={Route} title="Completează profilul financiar">
            Avem nevoie de venitul, cheltuielile și economiile tale ca să-ți arătăm cum evoluează banii.
          </EmptyState>
        </Card>
      </div>
    );
  if (model.status === 'fara-anunturi') {
    return (
      <div className="space-y-2">
        {header}
        <Notice tone="warn">Salvează cel puțin un anunț la care se cunoaște chiria ca să vezi cum evoluează economiile.</Notice>
        {model.incomplete.map((i) => (
          <Notice key={i.listingId}>
            {i.titlu}: {i.motive.map((m) => INCOMPLETE_MESSAGES[m] ?? m).join(' ')}
          </Notice>
        ))}
      </div>
    );
  }

  const demo = settings.modDemo || model.paths.some((p) => p.demonstrativ);
  return (
    <div className="space-y-5">
      {header}
      <Card title="Ce vrei să vezi" icon={SlidersHorizontal} action={demo ? <DemoBadge /> : null}>
        <Controls simSettings={simSettings} passport={passport} completeItems={completeItems} />
      </Card>

      <Card>
        <Crossroads model={model} lunaStart={simSettings.lunaStart} prag={model.sim.pragSigur} storms={storms} header />
        <div className="mt-4 space-y-2">
          {model.sim.avertizari.map((w) => (
            <Notice key={`${w.cod}-${w.luna}-${w.mesaj}`} tone={w.cod === 'CHIRIE_PESTE_BUGET' || w.cod === 'MUTARE_DUPA_PERIOADA' ? 'warn' : 'info'}>
              {w.luna !== null ? `Din ${monthLabel(simSettings.lunaStart, w.luna, { luni: model.xLuni })}: ` : ''}
              {w.mesaj}
            </Notice>
          ))}
          {model.plan?.luniVerificateDupaMutare && model.plan.drum.luni.length > model.sim.luni && (
            <Notice>Linia verde continuă {model.plan.drum.luni.length} luni, ca să vezi și cele {model.plan.luniVerificateDupaMutare} luni de după mutarea recomandată.</Notice>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <PathToYesCard model={model} planChoice={planChoice} onChoose={setPlanChoice} />
        </div>
        <StormsPanel storms={storms} simSettings={simSettings} passport={passport} settings={settings} aiReady={health?.ok === true} />
      </div>

      <Card title="Pe scurt, pentru fiecare variantă" icon={Gauge} padded={false} className="overflow-hidden">
        <Indicators model={model} lunaStart={simSettings.lunaStart} prag={model.sim.pragSigur} />
      </Card>

      <details className="rounded-[var(--radius-card)] border border-black/[0.05] bg-card p-4 text-[12px] text-muted shadow-[var(--shadow-card)]">
        <summary className="cursor-pointer text-[13px] font-medium text-ink">Cum am calculat</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {SIMULATION_ASSUMPTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
          {model.sim.luni > 12 && <li>După primele 12 luni, estimările sunt mai puțin sigure.</li>}
        </ul>
      </details>
    </div>
  );
}
