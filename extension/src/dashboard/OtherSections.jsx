// RentSmart — Comparația anunțurilor salvate și Setările.
import { Columns3, Database, FlaskConical, ScanSearch, ShieldCheck, Sparkles, Trash2, Trophy } from 'lucide-react';
import AutoAnalysisSwitch from '../ui/AutoAnalysisSwitch.jsx';
import { averageMonthlyCost } from '../shared/engine/compare.js';
import { clearAllData, updateSettings } from '../storage/index.js';
import { loadDemoScenario } from '../storage/appData.js';
import { Button, Card, DemoBadge, EmptyState, Notice, PageHeader, Pill, Switch } from '../ui/components.jsx';
import { INCOMPLETE_MESSAGES, formatRON } from '../ui/format.js';
import { useConfirm } from '../ui/useConfirm.jsx';

const TH = 'px-4 py-3 text-left text-[12px] font-semibold tracking-wide text-muted uppercase';
const TD = 'num px-4 py-3.5 text-[14px] text-ink';

export function ComparisonSection({ items, comparatie, ctx }) {
  const header = <PageHeader title="Comparație" description="Comparăm doar anunțurile salvate de tine, nu toate ofertele de pe piață." />;
  if (!ctx)
    return (
      <div>
        {header}
        <Notice tone="warn">Completează profilul financiar ca să compari anunțurile salvate.</Notice>
      </div>
    );
  if (items.length < 2)
    return (
      <div>
        {header}
        <Card>
          <EmptyState icon={Columns3} title="Ai nevoie de cel puțin două anunțuri">
            Salvează cel puțin două anunțuri ca să le compari.
          </EmptyState>
        </Card>
      </div>
    );
  const best = comparatie.celMaiMicCostLunar?.listingId;
  return (
    <div>
      {header}
      {comparatie.mesaje.length > 0 && (
        <div className="mb-5 space-y-2">
          {comparatie.mesaje.map((m) => (
            <Notice key={m}>
              {m}
            </Notice>
          ))}
        </div>
      )}
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line bg-[#fbfbfd]">
              <tr>
                <th className={TH}>Anunț</th>
                <th className={`${TH} text-right`}>Chirie</th>
                <th className={`${TH} text-right`}>Pe lună, vara</th>
                <th className={`${TH} text-right`}>Pe lună, iarna</th>
                <th className={`${TH} text-right`}>În medie pe lună</th>
                <th className={`${TH} text-right`}>La mutare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(({ saved, tc }) => {
                const isBest = saved.analiza.id === best;
                return (
                  <tr key={saved.analiza.id} className={isBest ? 'bg-found-soft/60' : ''}>
                    <td className="px-4 py-3.5 text-[14px] text-ink">
                      <div className="font-medium">{saved.analiza.titlu ?? 'Fără titlu'}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {isBest && (
                          <Pill tone="ok" dot={false}>
                            <Trophy size={12} aria-hidden="true" /> Cel mai mic cost
                          </Pill>
                        )}
                        {saved.analiza.demonstrativ && <DemoBadge />}
                      </div>
                    </td>
                    {tc?.complet ? (
                      <>
                        <td className={`${TD} text-right`}>{formatRON(tc.lunar.chirie.sumaRON)}</td>
                        <td className={`${TD} text-right`}>{formatRON(tc.totaluri.lunarVara)}</td>
                        <td className={`${TD} text-right`}>{formatRON(tc.totaluri.lunarIarna)}</td>
                        <td className={`${TD} text-right font-semibold`}>{formatRON(averageMonthlyCost(tc))}</td>
                        <td className={`${TD} text-right`}>{formatRON(tc.totaluri.plataLaMutare)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-4 py-3.5 text-[13px] text-muted">
                        {(tc?.motiveIncomplet ?? []).map((m) => INCOMPLETE_MESSAGES[m] ?? m).join(' ')}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-muted">„În medie pe lună” ține cont că iarna (noiembrie–martie, 5 luni) întreținerea e mai mare decât vara (7 luni). Cum evoluează economiile vezi la „Economii în timp”.</p>
    </div>
  );
}

export function SettingsSection({ settings }) {
  const [confirm, dialog] = useConfirm();
  return (
    <div>
      {dialog}
      <PageHeader title="Setări" description="Modul demonstrativ, acordul pentru AI și datele salvate în acest browser." />
      <div className="grid max-w-3xl gap-5">
        <Card title="Mod demonstrativ" icon={FlaskConical}>
          <Switch
            checked={settings.modDemo}
            onChange={(v) => updateSettings({ modDemo: v })}
            label="Folosește răspunsuri înregistrate"
            description="Fără internet; fiecare rezultat e etichetat „DATE DEMONSTRATIVE”. Estimările folosesc intervalele fictive ale scenariului demo."
          />
          <div className="mt-4 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Încarci scenariul demonstrativ?',
                  message: 'Profilul financiar, cursul, anunțurile salvate și situațiile neprevăzute vor fi înlocuite cu date FICTIVE.',
                  confirmLabel: 'Încarcă scenariul',
                });
                if (ok) loadDemoScenario();
              }}
            >
              Încarcă scenariul demonstrativ
            </Button>
          </div>
        </Card>
        <Card title="Analiză automată" icon={ScanSearch}>
          <AutoAnalysisSwitch settings={settings} />
        </Card>
        <Card title="Citirea anunțurilor cu AI" icon={Sparkles}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink">
              Ai fost de acord ca textul anunțurilor să fie trimis la AI:{' '}
              {settings.acordAI ? <Pill tone="ok">da</Pill> : <Pill tone="neutral">nu</Pill>}
            </p>
            {settings.acordAI && (
              <Button variant="secondary" size="sm" onClick={() => updateSettings({ acordAI: false })}>
                Retrage acordul
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
            <ShieldCheck size={15} className="mt-0.5 flex-none text-green" aria-hidden="true" />
            La AI ajunge doar textul anunțului, cu telefoanele și e-mailurile ascunse. Datele financiare nu se trimit niciodată.
          </p>
        </Card>
        <Card title="Datele tale" icon={Database}>
          <p className="text-[14px] text-muted">Profilul financiar, anunțurile salvate, cursul și setările stau doar în acest browser.</p>
          <Button
            variant="danger"
            icon={Trash2}
            className="mt-4"
            onClick={async () => {
              const ok = await confirm({
                title: 'Ștergi toate datele?',
                message: 'Profilul financiar, anunțurile salvate, cursul, situațiile neprevăzute și setările din acest browser vor fi șterse. Nu le mai poți recupera.',
                confirmLabel: 'Șterge tot',
                danger: true,
              });
              if (ok) clearAllData();
            }}
          >
            Șterge toate datele
          </Button>
        </Card>
      </div>
    </div>
  );
}
