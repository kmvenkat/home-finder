import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const app  = express();
const PORT = process.env.PORT || 3001;
const GOOGLE_KEY  = process.env.GOOGLE_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ── middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ── health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── maps JS key (restricted to your domain in Google Cloud Console) ────────────
app.get('/api/maps-key', (_req, res) => {
  if (!process.env.MAPS_JS_KEY) {
    return res.status(500).json({ error: 'MAPS_JS_KEY not configured' });
  }
  res.json({ key: process.env.MAPS_JS_KEY });
});

// ── geocoding ──────────────────────────────────────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`;
    const r    = await fetch(url);
    const data = await r.json();

    if (data.status !== 'OK' || !data.results[0]) {
      return res.status(404).json({ error: `Geocode failed: ${data.status}` });
    }

    const result  = data.results[0];
    const { lat, lng } = result.geometry.location;
    res.json({
      lat,
      lng,
      locType: result.geometry.location_type,
    });
  } catch (err) {
    console.error('[geocode]', err);
    res.status(500).json({ error: 'Geocode request failed' });
  }
});

// ── street view metadata ───────────────────────────────────────────────────────
app.get('/api/streetview', async (req, res) => {
  const { lat, lng, radius = 50 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  try {
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${GOOGLE_KEY}&source=outdoor&radius=${radius}`;
    const r    = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error('[streetview]', err);
    res.status(500).json({ error: 'Street View request failed' });
  }
});

// ── street view static image proxy ───────────────────────────────────────────
app.get('/api/streetview-image', async (req, res) => {
  const { lat, lng, size = '440x360' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  if (!GOOGLE_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });

  try {
    const url = `https://maps.googleapis.com/maps/api/streetview?size=${encodeURIComponent(
      String(size),
    )}&location=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(GOOGLE_KEY)}`;
    const upstream = await fetch(url);

    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    res.status(upstream.status);
    res.setHeader('Content-Type', ct);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error('[streetview-image]', err);
    res.status(500).json({ error: 'Street View image request failed' });
  }
});

// ── redfin proxy ───────────────────────────────────────────────────────────────
app.get('/api/redfin', async (req, res) => {
  const {
    min_beds, min_baths, min_sqft, min_price, max_price,
    num_homes, start = 0,
    max_lat, min_lat, max_long, min_long,
  } = req.query;

  // Validate required bounding box params
  if (!max_lat || !min_lat || !max_long || !min_long) {
    return res.status(400).json({ error: 'Bounding box params required' });
  }

  const params = new URLSearchParams({
    al: 1, uipt: '1', sf: '1,2,3,5,6,7', v: 8,
    ...(min_beds   && { min_beds }),
    ...(min_baths  && { min_baths }),
    ...(min_sqft   && { min_sqft }),
    ...(min_price  && { min_price }),
    ...(max_price  && { min_price, max_price }),
    num_homes: num_homes || 50,
    start,
    max_lat, min_lat, max_long, min_long,
  });

  try {
    const url = `https://www.redfin.com/stingray/api/gis?${params}`;
    const r   = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://www.redfin.com/',
      },
    });
    const text = await r.text();
    // Redfin prepends {}&& to JSON — strip it
    const json = JSON.parse(text.replace('{}&&', ''));
    res.json(json);
  } catch (err) {
    console.error('[redfin]', err);
    res.status(500).json({ error: 'Redfin request failed' });
  }
});

// ── start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
