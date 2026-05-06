// Available project icons — files in /public/project_icons/
export const PROJECT_ICONS = [
  'airplane',
  'auth',
  'car',
  'cart',
  'cloud',
  'database',
  'desktop',
  'editor',
  'gateway',
  'globe',
  'keyboard',
  'mobile',
  'payment',
  'rocket',
  'settings',
  'user',
  'usergroup',
] as const;

export type ProjectIconId = (typeof PROJECT_ICONS)[number];

type ProjectIconMeta = {
  scale: number;
  blendMode?: 'normal' | 'multiply';
};

const DEFAULT_PROJECT_ICON_META: ProjectIconMeta = {
  scale: 1,
  blendMode: 'normal',
};

const PROJECT_ICON_META: Record<ProjectIconId, ProjectIconMeta> = {
  airplane: { scale: 1.18 },
  auth: { scale: 1.08 },
  car: { scale: 1.16, blendMode: 'multiply' },
  cart: { scale: 1.12 },
  cloud: { scale: 1.14, blendMode: 'multiply' },
  database: { scale: 1.08 },
  desktop: { scale: 1.08 },
  editor: { scale: 1.06 },
  gateway: { scale: 1.1 },
  globe: { scale: 1.08 },
  keyboard: { scale: 1.08 },
  mobile: { scale: 1.14, blendMode: 'multiply' },
  payment: { scale: 1.1 },
  rocket: { scale: 1.16 },
  settings: { scale: 1.14, blendMode: 'multiply' },
  user: { scale: 1.12, blendMode: 'multiply' },
  usergroup: { scale: 1.2 },
};

export function getProjectIconUrl(icon: string): string {
  return `/project_icons/${icon}.png`;
}

export function getProjectIconMeta(icon?: string): ProjectIconMeta {
  if (!icon) return DEFAULT_PROJECT_ICON_META;
  return PROJECT_ICON_META[icon as ProjectIconId] ?? DEFAULT_PROJECT_ICON_META;
}
