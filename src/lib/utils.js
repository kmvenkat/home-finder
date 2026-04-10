export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString();
}

