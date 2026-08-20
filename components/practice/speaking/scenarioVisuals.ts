
import {
  Bus,
  CalendarDays,
  CloudSun,
  Handshake,
  Hotel,
  LucideIcon,
  MapPinned,
  ShoppingBag,
  Stethoscope,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

// Purely a frontend presentation concern — the icon/color for a scenario is
// never stored in the database (SpeakingScenario has no visual field). The
// backend stays the single source of truth for scenario CONTENT; this file
// only decides how that content is illustrated.
export interface ScenarioVisual {
  icon: LucideIcon;
  className: string;
}

type ScenarioVisualKey =
  | 'introduction'
  | 'greeting'
  | 'restaurant'
  | 'directions'
  | 'shopping'
  | 'hotel'
  | 'family'
  | 'doctor'
  | 'bus'
  | 'weather'
  | 'event';

export const scenarioVisuals: Record<ScenarioVisualKey, ScenarioVisual> = {
  introduction: { icon: Users, className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  greeting: { icon: Handshake, className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  restaurant: { icon: UtensilsCrossed, className: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  directions: { icon: MapPinned, className: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  shopping: { icon: ShoppingBag, className: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  hotel: { icon: Hotel, className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  family: { icon: Users, className: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  doctor: { icon: Stethoscope, className: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  bus: { icon: Bus, className: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  weather: { icon: CloudSun, className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  event: { icon: CalendarDays, className: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

// Matched against `scenario.name` — the stable, server-authored English
// identifier — never against the currently-DISPLAYED title. Matching on the
// localized string would make the icon depend on which language happens to
// be active; name/nameVi can both change wording without touching this.
export function resolveScenarioVisual(name: string): ScenarioVisual {
  const value = name.toLowerCase();

  if (value.includes('introduction') && !value.includes('party')) return scenarioVisuals.introduction;
  if (value.includes('greeting') || value.includes('colleague')) return scenarioVisuals.greeting;
  if (value.includes('restaurant') || value.includes('food') || value.includes('order')) return scenarioVisuals.restaurant;
  if (value.includes('direction')) return scenarioVisuals.directions;
  if (value.includes('shop') || value.includes('clothing')) return scenarioVisuals.shopping;
  if (value.includes('hotel')) return scenarioVisuals.hotel;
  if (value.includes('family')) return scenarioVisuals.family;
  if (value.includes('doctor')) return scenarioVisuals.doctor;
  if (value.includes('bus')) return scenarioVisuals.bus;
  if (value.includes('weather')) return scenarioVisuals.weather;
  if (value.includes('party') || value.includes('event')) return scenarioVisuals.event;

  return scenarioVisuals.introduction;
}

const LEVEL_STYLES: Record<string, string> = {
  A1: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  A2: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  B1: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
  B2: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  C1: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400',
  C2: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
};

const DEFAULT_LEVEL_STYLE = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

export function getLevelStyle(level: string | null): string {
  if (!level) return DEFAULT_LEVEL_STYLE;
  return LEVEL_STYLES[level] ?? DEFAULT_LEVEL_STYLE;
}
