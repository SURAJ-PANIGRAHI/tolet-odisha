// Private management credentials stay in this browser; never use this cache as server authorization.
export type SavedListing = { id: string; path: string; title: string; locality: string; rent: number; savedAt: string };
const STORAGE_KEY = 'tolet:managed-listings:v1';
export function managementPath(value: string): string | null {
  try {
    const url = new URL(value, 'https://toletodisha.in');
    if (url.pathname !== '/manage') return null;
    const id = url.searchParams.get('listing') || '';
    const key = new URLSearchParams(url.hash.slice(1)).get('key') || url.searchParams.get('key') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^[0-9a-f]{64}$/.test(key)) return null;
    return `/manage?${url.searchParams.get('portal') === '1' ? 'portal=1&' : ''}listing=${id}#key=${key}`;
  } catch { return null; }
}
export function savedListings(): SavedListing[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is SavedListing => !!row && typeof row.id === 'string' && typeof row.path === 'string' && managementPath(row.path) === row.path && new URL(row.path, 'https://toletodisha.in').searchParams.get('listing') === row.id && typeof row.title === 'string' && typeof row.locality === 'string' && typeof row.rent === 'number' && typeof row.savedAt === 'string').slice(0, 100);
  } catch { return []; }
}
export function saveListing(row: SavedListing): boolean {
  try {
    const path = managementPath(row.path);
    if (!path || new URL(path, 'https://toletodisha.in').searchParams.get('listing') !== row.id) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...row, path }, ...savedListings().filter(x => x.id !== row.id)].slice(0, 100)));
    window.dispatchEvent(new Event('tolet-listings-changed'));
    return true;
  } catch { return false; }
}
export function forgetListing(id: string) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedListings().filter(row => row.id !== id))); window.dispatchEvent(new Event('tolet-listings-changed')); } catch { /* Storage may be disabled. */ }
}
