export function haversine(la1, ln1, la2, ln2) {
  const R = 6371000;
  const p1 = (la1 * Math.PI) / 180;
  const p2 = (la2 * Math.PI) / 180;
  const dp = ((la2 - la1) * Math.PI) / 180;
  const dl = ((ln2 - ln1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(la1, ln1, la2, ln2) {
  const r1 = (la1 * Math.PI) / 180;
  const r2 = (la2 * Math.PI) / 180;
  const dl = ((ln2 - ln1) * Math.PI) / 180;
  const x = Math.sin(dl) * Math.cos(r2);
  const y =
    Math.cos(r1) * Math.sin(r2) -
    Math.sin(r1) * Math.cos(r2) * Math.cos(dl);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

export function cardinal(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

export function nearestCardDev(d) {
  return Math.min(...[0, 90, 180, 270, 360].map((c) => (Math.abs(d - c) % 360)));
}

export function bearingDiff(a, b) {
  return Math.abs(((a - b + 180) % 360) - 180);
}

export function mileToLatDeg(miles) {
  return miles / 69.0;
}

export function mileToLngDeg(miles, lat) {
  return miles / (69.0 * Math.cos((lat * Math.PI) / 180));
}
