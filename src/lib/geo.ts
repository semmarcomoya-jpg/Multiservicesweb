/** Todos los países (con continente) y sus estados/municipios, que se bajan solo cuando se necesitan. */
import { Platform } from 'react-native';

import BASE from './geo-base.json';

export type Continent = 'am' | 'eu' | 'as' | 'af' | 'oc';
export const CONTINENTS: { v: Continent; es: string; en: string }[] = [
  { v: 'am', es: 'América', en: 'Americas' },
  { v: 'eu', es: 'Europa', en: 'Europe' },
  { v: 'as', es: 'Asia', en: 'Asia' },
  { v: 'af', es: 'África', en: 'Africa' },
  { v: 'oc', es: 'Oceanía', en: 'Oceania' },
];

const AM = 'AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI UM';
const EU = 'AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK';
const AF = 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW';
const OC = 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TL TO TV VU WF WS';
const CONT: Record<string, Continent> = {};
AM.split(' ').forEach((c) => (CONT[c] = 'am'));
EU.split(' ').forEach((c) => (CONT[c] = 'eu'));
AF.split(' ').forEach((c) => (CONT[c] = 'af'));
OC.split(' ').forEach((c) => (CONT[c] = 'oc'));
export const continentOf = (c?: string | null): Continent => CONT[c || ''] || 'as';

type Base = { c: string; f: string; p: string; m: string };
const LIST = BASE as Base[];

let dnEs: Intl.DisplayNames | null = null;
let dnEn: Intl.DisplayNames | null = null;
try {
  dnEs = new Intl.DisplayNames(['es'], { type: 'region' });
  dnEn = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {}
export const countryName = (c: string, lang: 'es' | 'en' = 'es') => {
  try {
    return (lang === 'es' ? dnEs : dnEn)?.of(c) || c;
  } catch {
    return c;
  }
};

export interface GeoCountry { c: string; flag: string; phone: string; cur: string; cont: Continent; es: string; en: string }
let cache: GeoCountry[] | null = null;
export function allCountries(): GeoCountry[] {
  if (cache) return cache;
  cache = LIST.map((x) => ({ c: x.c, flag: x.f, phone: x.p, cur: x.m, cont: continentOf(x.c), es: countryName(x.c, 'es'), en: countryName(x.c, 'en') })).sort((a, b) => a.es.localeCompare(b.es, 'es'));
  return cache;
}
export const geoCountry = (c?: string | null) => allCountries().find((x) => x.c === c);

/** Carpeta de la app (en GitHub Pages: /Multiservicesweb/). */
function base() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 'https://semmarcomoya-jpg.github.io/Multiservicesweb/';
  const m = (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href;
  return m ? m.replace(/manifest\.json$/, '') : window.location.origin + '/';
}

export interface GeoState { n: string; c: string[] }
const states: Record<string, Promise<GeoState[]>> = {};
/** Estados (o departamentos/provincias) de un país, cada uno con sus municipios o ciudades. */
export function loadStates(country: string): Promise<GeoState[]> {
  if (!country) return Promise.resolve([]);
  if (!states[country])
    states[country] = fetch(`${base()}geo/${country}.json`)
      .then((r) => (r.ok ? r.json() : { s: [] }))
      .then((j: { s: GeoState[] }) => j.s || [])
      .catch(() => {
        delete states[country];
        return [];
      });
  return states[country];
}
