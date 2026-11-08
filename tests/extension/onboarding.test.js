// Prima utilizare: bun venit la instalare, formularul de buget → Financial Passport, salvarea, utilizatorii
// existenți, „Încearcă un exemplu” fără a atinge datele reale, rezumatul din motor.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOpenWelcome, WELCOME_URL_PATH } from '../../extension/src/background/onboarding.js';
import { profileFromSetupForm, setupFormFrom } from '../../extension/src/dashboard/setupForm.js';
import { DATA_KEYS, saveListing } from '../../extension/src/storage/appData.js';
import { STORAGE_KEYS, getSettings, getValue, updateSettings } from '../../extension/src/storage/index.js';
import { EXAMPLE_BACKUP_KEY, enterExample, exitExample, hasProfile, isExampleActive, saveProfile } from '../../extension/src/storage/profile.js';
import { isOnboardingDone, resolveSection, visibleSections } from '../../extension/src/dashboard/navigation.js';
import { monthlyLeftoverNow } from '../../extension/src/shared/engine/budget.js';
import { simulate } from '../../extension/src/shared/engine/simulate.js';
import { computeTrueCost } from '../../extension/src/shared/engine/trueCost.js';
import { ContractError } from '../../extension/src/shared/contracts/schemas.js';
import { demoCostReference, demoExchangeRate, demoListingB, demoPassport, demoSavedB } from '../../extension/src/shared/contracts/fixtures/demoScenario.js';

function fakeChrome() {
  let data = {};
  return {
    dump: () => data,
    storage: {
      local: {
        async get(keys) {
          const ks = keys == null ? Object.keys(data) : [].concat(keys);
          return Object.fromEntries(ks.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) data[k] = structuredClone(v);
        },
        async remove(keys) {
          for (const k of [].concat(keys)) delete data[k];
        },
        async clear() {
          data = {};
        },
      },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

beforeEach(() => {
  globalThis.chrome = fakeChrome();
});

const FULL = { venit: '5200', cheltuieli: '1500', locuinta: '400', transport: '150', economii: '6000', buget: '2000', rezerva: '1000', mutare: '3', mutareAlta: '' };

test('1–2. pagina de bun venit: doar la instalare nouă, fără profil; nu la update, actualizare Chrome sau repornire', async () => {
  const none = async () => null;
  assert.equal(await shouldOpenWelcome({ reason: 'install' }, none), true);
  assert.equal(await shouldOpenWelcome({ reason: 'update', previousVersion: '0.1.0' }, none), false);
  assert.equal(await shouldOpenWelcome({ reason: 'chrome_update' }, none), false);
  assert.equal(await shouldOpenWelcome({ reason: 'shared_module_update' }, none), false);
  assert.equal(await shouldOpenWelcome(undefined, none), false);
  // 3. Profil existent (ex. date păstrate): nu-l trimitem la configurare.
  assert.equal(await shouldOpenWelcome({ reason: 'install' }, async () => demoPassport), false);
  assert.equal(WELCOME_URL_PATH, 'dashboard.html#bun-venit');
});

test('5. formularul: câmpurile se salvează în Passport-ul existent, fără dublări', () => {
  const r = profileFromSetupForm(FULL, null);
  assert.equal(r.ok, true);
  assert.deepEqual(r.passport, {
    schemaVersion: 1,
    venitNetLunar: 5200,
    cheltuieliEsentialeLunare: 1500, // fără locuință și fără transport
    costLocuintaActuala: 400,
    transportActualLunar: 150, // câmp separat: nu e inclus și în cheltuieli
    economiiDisponibile: 6000,
    rezervaMinima: 1000,
    bugetMaximChirie: 2000,
    lunaMutarii: 3,
    obiectiv: null,
  });
  // Formatul românesc al sumelor e acceptat; obiectivul unui profil existent se păstrează.
  assert.equal(profileFromSetupForm({ ...FULL, venit: '5.200' }, { ...demoPassport, obiectiv: 'Lângă facultate' }).passport.obiectiv, 'Lângă facultate');
  // „Altă perioadă”.
  assert.equal(profileFromSetupForm({ ...FULL, mutare: 'alta', mutareAlta: '12' }).passport.lunaMutarii, 12);
});

test('5 / 11. validare: câmpuri goale sau invalide → mesaje în română; necunoscutul nu devine 0 fără confirmare', () => {
  const empty = profileFromSetupForm({ ...FULL, venit: '', economii: 'multe', transport: '-5' });
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.venit, 'Completează acest câmp. Scrie 0 dacă nu ai.');
  assert.match(empty.errors.economii, /doar cifre/);
  assert.match(empty.errors.transport, /doar cifre/);
  assert.match(profileFromSetupForm({ ...FULL, mutare: 'alta', mutareAlta: '70' }).errors.mutareAlta, /între 0 și 60/);
  // Câmpurile opționale goale: cerem confirmare (nu completăm singuri cu 0).
  const missing = profileFromSetupForm({ ...FULL, rezerva: '', mutare: '' });
  assert.deepEqual(missing, { ok: false, needsConfirm: ['rezerva', 'mutare'] });
  const confirmed = profileFromSetupForm({ ...FULL, rezerva: '', mutare: '' }, null, { confirmDefaults: true });
  assert.deepEqual([confirmed.passport.rezervaMinima, confirmed.passport.lunaMutarii], [0, 0]);
  // 0 scris explicit de utilizator e acceptat ca atare.
  assert.equal(profileFromSetupForm({ ...FULL, locuinta: '0' }).passport.costLocuintaActuala, 0);
});

test('fără date inventate: formularul nou e gol; „Modifică datele” pornește de la profilul salvat (dus-întors identic)', () => {
  assert.deepEqual(Object.values(setupFormFrom(null)).filter(Boolean), []);
  for (const p of [demoPassport, { ...demoPassport, lunaMutarii: 17 }, { ...demoPassport, lunaMutarii: 0, obiectiv: null }]) {
    assert.deepEqual(profileFromSetupForm(setupFormFrom(p), p).passport, p);
  }
});

test('4 / 6 / 7. salvarea: în Passport (aceeași sursă de adevăr), marcată finalizată doar după succes; rămâne după reîncărcare', async () => {
  const r = profileFromSetupForm(FULL);
  await saveProfile(r.passport);
  assert.deepEqual(await getValue(DATA_KEYS.PASSPORT), r.passport);
  assert.equal((await getSettings()).profilConfigurat, true);
  // „Reîncărcare”: o citire nouă din storage întoarce aceleași date.
  assert.deepEqual((await globalThis.chrome.storage.local.get(DATA_KEYS.PASSPORT))[DATA_KEYS.PASSPORT], r.passport);
  assert.ok(hasProfile(await getValue(DATA_KEYS.PASSPORT)));
});

test('11. salvare eșuată (date invalide): profilul existent rămâne neatins, configurarea nu e marcată', async () => {
  await globalThis.chrome.storage.local.set({ [DATA_KEYS.PASSPORT]: demoPassport });
  await assert.rejects(saveProfile({ ...demoPassport, venitNetLunar: -1 }), ContractError);
  assert.deepEqual(await getValue(DATA_KEYS.PASSPORT), demoPassport);
  assert.equal((await getSettings()).profilConfigurat, undefined);
});

test('8. „Modifică datele”: profilul nou înlocuiește Passport-ul, iar anunțurile salvate rămân', async () => {
  await globalThis.chrome.storage.local.set({ [DATA_KEYS.PASSPORT]: demoPassport });
  await saveListing(demoListingB, new Date('2027-01-05T08:00:00.000Z'));
  const edited = profileFromSetupForm({ ...setupFormFrom(demoPassport), venit: '6000' }, demoPassport);
  await saveProfile(edited.passport);
  assert.equal((await getValue(DATA_KEYS.PASSPORT)).venitNetLunar, 6000);
  assert.equal((await getValue(DATA_KEYS.SAVED_LISTINGS)).length, 1);
});

test('9. „Încearcă un exemplu” nu atinge datele reale: la ieșire revin exact (inclusiv cheile care lipseau)', async () => {
  const real = { ...demoPassport, venitNetLunar: 3100, obiectiv: 'Datele mele' };
  await globalThis.chrome.storage.local.set({ [DATA_KEYS.PASSPORT]: real });
  await updateSettings({ acordAI: true, analizaAutomata: true });
  const before = structuredClone(globalThis.chrome.dump());
  await enterExample();
  assert.equal(await isExampleActive(), true);
  assert.equal((await getValue(DATA_KEYS.PASSPORT)).venitNetLunar, demoPassport.venitNetLunar); // date fictive afișate
  assert.equal((await getValue(DATA_KEYS.SAVED_LISTINGS)).length, 2);
  assert.equal((await getSettings()).modDemo, true);
  await enterExample(); // a doua intrare nu suprascrie copia datelor reale cu date demo
  assert.equal(await exitExample(), true);
  assert.deepEqual(globalThis.chrome.dump(), before); // identic: profil, setări; anunțuri/furtuni inexistente rămân inexistente
  assert.equal(await exitExample(), false);
});

test('9. configurarea în timpul exemplului salvează profilul real (nu în datele demo, nu pierdut la ieșire)', async () => {
  await enterExample();
  const mine = profileFromSetupForm(FULL).passport;
  await saveProfile(mine);
  assert.equal(await isExampleActive(), false);
  assert.deepEqual(await getValue(DATA_KEYS.PASSPORT), mine);
  assert.equal(await getValue(DATA_KEYS.SAVED_LISTINGS), undefined); // anunțurile demo nu au rămas
  assert.equal((await getSettings()).modDemo, false);
  assert.equal(await getValue(EXAMPLE_BACKUP_KEY), undefined);
});

test('10. motorul folosește profilul salvat: „Bani rămași lunar” = fluxul lunar al simulării înainte de mutare', async () => {
  const p = profileFromSetupForm(FULL).passport;
  await saveProfile(p);
  const saved = await getValue(DATA_KEYS.PASSPORT);
  assert.equal(monthlyLeftoverNow(saved), 5200 - 1500 - 400 - 150);
  const tc = computeTrueCost(demoSavedB, { passport: saved, costReference: demoCostReference, exchangeRate: demoExchangeRate });
  const sim = simulate({ passport: saved, apartamente: [tc], luni: 12, lunaStart: 1, furtuni: [] });
  assert.equal(sim.drumuri[0].luni[0].faza, 'inainte');
  assert.equal(sim.drumuri[0].luni[0].flux, monthlyLeftoverNow(saved));
  assert.equal(monthlyLeftoverNow(null), null);
  // Profil schimbat → rezultatele dependente se schimbă.
  await saveProfile({ ...saved, venitNetLunar: 4000 });
  assert.equal(monthlyLeftoverNow(await getValue(DATA_KEYS.PASSPORT)), 4000 - 1500 - 400 - 150);
  assert.equal(STORAGE_KEYS.SETTINGS, 'setari');
});

test('„Bugetul tău” doar la prima utilizare: după configurare dispare și duce la „Profilul meu financiar”', async () => {
  const MENU = ['buget', 'passport', 'anunturi', 'setari'].map((id) => ({ id }));
  const state = async () => ({ passport: await getValue(DATA_KEYS.PASSPORT), settings: await getSettings(), exampleActive: await isExampleActive() });

  // Prima utilizare: fără profil → „Bugetul tău” e pagina implicită și apare în meniu.
  let done = isOnboardingDone(await state());
  assert.equal(done, false);
  assert.equal(resolveSection(null, done), 'buget');
  assert.equal(resolveSection('bun-venit', done), 'bun-venit');
  assert.deepEqual(visibleSections(MENU, done).map((s) => s.id), ['buget', 'passport', 'anunturi', 'setari']);

  // „Încearcă un exemplu”: profil fictiv, dar utilizatorul e încă la prima utilizare.
  await enterExample();
  done = isOnboardingDone(await state());
  assert.equal(done, false, 'exemplul nu încheie configurarea');
  assert.equal(resolveSection('buget', done), 'buget');
  await exitExample();

  // Salvarea profilului încheie configurarea (persistat în storage: rezistă la reîncărcare/redeschidere).
  await saveProfile(demoPassport);
  done = isOnboardingDone(await state());
  assert.equal(done, true);
  assert.equal((await getSettings()).profilConfigurat, true);
  assert.equal(resolveSection(null, done), 'passport', 'vizitele următoare încep în „Profilul meu financiar”');
  for (const old of ['buget', 'bun-venit', 'configurare']) assert.equal(resolveSection(old, done), 'passport', old);
  assert.equal(resolveSection('anunturi', done), 'anunturi');
  assert.deepEqual(visibleSections(MENU, done).map((s) => s.id), ['passport', 'anunturi', 'setari']);

  // Utilizator existent, de dinainte de indicator: profilul din date contează.
  assert.equal(isOnboardingDone({ passport: demoPassport, settings: {}, exampleActive: false }), true);
  // Indicatorul singur ajunge (de ex. profilul e încă în curs de citire).
  assert.equal(isOnboardingDone({ passport: null, settings: { profilConfigurat: true }, exampleActive: false }), true);
});
