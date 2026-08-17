export const FEATURES = [
  {
    icon: '📦',
    title: 'Manajemen Pengiriman',
    description: 'CRUD lengkap dengan 14 status lifecycle, auto-generated tracking number, dan SLA monitoring otomatis.',
  },
  {
    icon: '🗺️',
    title: 'Live Tracking Map',
    description: 'Pantau posisi driver real-time dengan Leaflet/OpenStreetMap, geofencing otomatis, dan rute teroptimasi OSRM.',
  },
  {
    icon: '🚛',
    title: 'Manajemen Armada',
    description: 'Kelola driver dan kendaraan dengan foto, data karyawan, status aktif, dan riwayat perawatan.',
  },
  {
    icon: '📱',
    title: 'Driver PWA App',
    description: 'Aplikasi driver berbasis PWA dengan task list, POD digital (tanda tangan + foto + GPS), dan laporan harian.',
  },
  {
    icon: '📊',
    title: 'Analytics & Report',
    description: 'Dashboard KPI real-time, tren 7 hari, top destinasi, scoring driver, dan export CSV.',
  },
  {
    icon: '🔒',
    title: 'Enterprise Security',
    description: 'RBAC 9 level, 2FA TOTP, Google SSO, rate limiting, brute-force protection, dan audit log lengkap.',
  },
  {
    icon: '💬',
    title: 'WhatsApp Integration',
    description: 'Notifikasi otomatis via WhatsApp Business API: status pengiriman, SLA breach, dan GPS disconnect alert.',
  },
  {
    icon: '📍',
    title: 'Geofencing',
    description: 'Perimeter otomatis untuk gudang, hub, area operasional, dan destinasi dengan event tracking masuk/keluar.',
  },
  {
    icon: '⚡',
    title: 'PWA & Offline',
    description: 'Progressive Web App dengan service worker offline caching. Installable di semua perangkat.',
  },
];

export const STATS = [
  { value: '200+', label: 'Perusahaan' },
  { value: '50K+', label: 'Pengiriman/Bulan' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' },
];

export const PRICING_PLANS = [
  {
    name: 'Starter',
    description: 'Cocok untuk UMKM yang baru mulai digitalisasi logistik.',
    price: 'Gratis',
    period: null,
    popular: false,
    cta: 'Mulai Gratis',
    features: [
      '5 user aktif',
      '100 pengiriman/bulan',
      '10 driver',
      'Tracking publik',
      'Basic dashboard',
      'Support email',
    ],
  },
  {
    name: 'Business',
    description: 'Untuk perusahaan logistik yang berkembang pesat.',
    price: 'Rp 2.5jt',
    period: 'bulan',
    popular: true,
    cta: 'Hubungi Sales',
    features: [
      '25 user aktif',
      '1.000 pengiriman/bulan',
      '50 driver',
      'Live map + geofencing',
      'Analytics lengkap',
      'WhatsApp integration',
      'API access',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Solusi custom untuk korporasi besar dengan kebutuhan khusus.',
    price: 'Custom',
    period: null,
    popular: false,
    cta: 'Hubungi Sales',
    features: [
      'Unlimited user',
      'Unlimited pengiriman',
      'Unlimited driver',
      'White-label branding',
      'Custom integrasi',
      'Dedicated server',
      'SLA guarantee',
      'Dedicated support team',
    ],
  },
];
