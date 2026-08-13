const BASE = 'http://localhost:3001';
const cookie = [];

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookies = res.headers.getSetCookie && res.headers.getSetCookie();
  if (setCookies && setCookies.length) cookie.length = 0, cookie.push(...setCookies.map((c) => c.split(';')[0]));
  return res.status;
}

(async () => {
  await login('admin', 'admin123');
  const H = { cookie: cookie.join('; ') };

  const res = await fetch(`${BASE}/api/gps/latest?minutes=120`, { headers: H });
  const data = await res.json();
  const withCoords = data.shipments.filter((s) => s.originLat != null && s.destLat != null);
  console.log('status:', res.status, '| shipments:', data.shipments.length, '| dengan koordinat asal-tujuan:', withCoords.length);
  const sample = withCoords[0];
  if (sample) console.log('contoh:', sample.trackingNumber, '| origin:', sample.originLat, sample.originLng, '-> dest:', sample.destLat, sample.destLng);

  // cek OSRM tersedia
  if (sample) {
    const osrm = await fetch(`https://router.project-osrm.org/route/v1/driving/${sample.originLng},${sample.originLat};${sample.destLng},${sample.destLat}?overview=full&geometries=geojson`);
    const osmJson = osrm.ok ? await osrm.json() : null;
    const n = osmJson?.routes?.[0]?.geometry?.coordinates?.length || 0;
    console.log('OSRM:', osrm.status, '| titik rute:', n, n > 0 ? 'OK' : '!!');
  }

  const map = await fetch(`${BASE}/map`, { headers: H });
  const html = await map.text();
  console.log('map page:', map.status, '| has toggle rute:', html.includes('Tampilkan Rute'));
})().catch((e) => { console.error(e); process.exit(1); });