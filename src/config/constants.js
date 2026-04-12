export const MAX_DIST = 30;
export const GRID_TOL = 20;
export const CORNER_DIFF = 60;
export const PROBE_OFF = 0.0002;
export const SV_RADIUS = 50;
export const DELAY_MS = 50;
export const PAGE_SIZE = 50; // homes per Redfin API request
export const MAX_PAGES = 6; // safety cap (300 homes total max)
export const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://home-finder-dcb0.onrender.com';
