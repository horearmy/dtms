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

export const LIVE_TRACKING_TABS = [
  {
    id: 'gps',
    label: 'Real-time GPS',
    title: 'Lacak posisi driver secara live',
    description: 'Pantau lokasi, kecepatan, dan rute driver setiap 15 detik. Semua armada terlihat dalam satu peta tanpa blind spot.',
    image: '/images/landing/shipment-dashboard.png',
    highlights: ['Update GPS 15 detik', 'Multi-armada dalam satu peta', 'History perjalanan'],
  },
  {
    id: 'geofencing',
    label: 'Geofencing',
    title: 'Alert otomatis masuk & keluar area',
    description: 'Buat perimeter digital untuk gudang, hub, dan destinasi. Dapatkan notifikasi instan saat driver melewati batas area.',
    image: '/images/landing/geofencing.png',
    highlights: ['Polygon & radius area', 'Event masuk/keluar', 'Notifikasi real-time'],
  },
  {
    id: 'driver',
    label: 'Driver App',
    title: 'Aplikasi driver yang terhubung',
    description: 'Driver menerima tugas, scan QR gudang, update status, POD digital, dan laporan harian langsung dari ponsel.',
    image: '/images/landing/driver-app.png',
    highlights: ['Task list & QR scan', 'POD tanda tangan + foto', 'Laporan harian digital'],
  },
  {
    id: 'alerts',
    label: 'Smart Alerts',
    title: 'Notifikasi WhatsApp otomatis',
    description: 'Kirim update status pengiriman, peringatan SLA, dan alert GPS disconnect langsung ke WhatsApp penerima atau tim operasional.',
    image: '/images/landing/whatsapp-notification.png',
    highlights: ['WhatsApp Business API', 'Status pengiriman otomatis', 'SLA breach alert'],
  },
];

export const HOW_IT_WORKS = [
  { step: '01', title: 'Plan', text: 'Masukkan order dan tetapkan tujuan delivery.' },
  { step: '02', title: 'Dispatch', text: 'Assign driver dan rute sesuai kapasitas.' },
  { step: '03', title: 'Track', text: 'Pantau posisi, ETA, SLA, dan exception real-time.' },
  { step: '04', title: 'Improve', text: 'Analisis performa untuk keputusan yang lebih baik.' },
];

export const FEATURE_CATEGORIES = [
  {
    code: 'operate',
    label: 'Operasikan',
    features: [
      { icon: '📦', title: 'Manajemen Pengiriman', description: 'CRUD lengkap dengan 14 status lifecycle, auto-generated tracking number, dan SLA monitoring otomatis.' },
      { icon: '🚛', title: 'Manajemen Armada', description: 'Kelola driver dan kendaraan dengan foto, data karyawan, status aktif, dan riwayat perawatan.' },
      { icon: '📍', title: 'Geofencing', description: 'Perimeter otomatis untuk gudang, hub, area operasional, dan destinasi dengan event tracking masuk/keluar.' },
    ],
  },
  {
    code: 'track',
    label: 'Pantau',
    features: [
      { icon: '🗺️', title: 'Live Tracking Map', description: 'Pantau posisi driver real-time dengan Leaflet/OpenStreetMap, geofencing otomatis, dan rute teroptimasi OSRM.' },
      { icon: '📱', title: 'Driver PWA App', description: 'Aplikasi driver berbasis PWA dengan task list, POD digital (tanda tangan + foto + GPS), dan laporan harian.' },
      { icon: '💬', title: 'WhatsApp Integration', description: 'Notifikasi otomatis via WhatsApp Business API: status pengiriman, SLA breach, dan GPS disconnect alert.' },
    ],
  },
  {
    code: 'analyze',
    label: 'Analisis',
    features: [
      { icon: '📊', title: 'Analytics & Report', description: 'Dashboard KPI real-time, tren 7 hari, top destinasi, scoring driver, dan export CSV.', image: '/images/landing/report-export.png' },
      { icon: '⚡', title: 'PWA & Offline', description: 'Progressive Web App dengan service worker offline caching. Installable di semua perangkat.' },
    ],
  },
  {
    code: 'secure',
    label: 'Amankan',
    features: [
      { icon: '🔒', title: 'Enterprise Security', description: 'RBAC 9 level, 2FA TOTP, Google SSO, rate limiting, brute-force protection, dan audit log lengkap.' },
    ],
  },
];

export const TESTIMONIALS = [
  {
    name: 'Budi Santoso',
    role: 'Operations Manager',
    company: 'Logistik Nusantara',
    avatar: null,
    quote: 'Sejak pakai DTMS, kami bisa memantau 40+ driver dalam satu dashboard. Customer complaint turun drastis karena mereka bisa tracking sendiri via WhatsApp.',
    rating: 5,
  },
  {
    name: 'Dewi Lestari',
    role: 'CEO',
    company: 'KirimAja Express',
    avatar: null,
    quote: 'Setup hanya 1 hari dan tim operasional langsung adaptif. Fitur geofencing membantu kami memastikan driver tepat waktu sampai ke gudang.',
    rating: 5,
  },
  {
    name: 'Ahmad Rizky',
    role: 'Fleet Supervisor',
    company: 'Jaya Trans Courier',
    avatar: null,
    quote: 'Laporan harian dan analytics membuat evaluasi driver jadi objektif. Kami hemat waktu administrasi hingga 70%.',
    rating: 5,
  },
];

export const CLIENT_LOGOS = [
  { name: 'Logistik Nusantara', initials: 'LN' },
  { name: 'KirimAja Express', initials: 'KE' },
  { name: 'Jaya Trans Courier', initials: 'JT' },
  { name: 'Mitra Delivery', initials: 'MD' },
  { name: 'SpeedLogistics', initials: 'SL' },
];

export const FAQS = [
  {
    question: 'Apakah DTMS cocok untuk UMKM logistik?',
    answer: 'Sangat cocok. DTMS menyediakan plan Free dan Starter yang terjangkau, namun tetap memiliki fitur live tracking, dispatch, dan laporan lengkap.',
  },
  {
    question: 'Berapa lama setup awal DTMS?',
    answer: 'Setup tenant, user, dan driver bisa dilakukan dalam hitungan jam. Untuk integrasi WhatsApp dan API opsional, biasanya memerlukan 1-3 hari kerja.',
  },
  {
    question: 'Apakah driver harus install aplikasi?',
    answer: 'Tidak wajib install. Aplikasi driver berbasis PWA, bisa dibuka via browser dan di-add ke home screen. Tersedia untuk Android dan iOS.',
  },
  {
    question: 'Bagaimana cara tracking pengiriman oleh pelanggan?',
    answer: 'Pelanggan bisa tracking melalui halaman publik `/tracking` dengan memasukkan nomor resi. Notifikasi otomatis juga dikirim via WhatsApp.',
  },
  {
    question: 'Apakah data saya aman?',
    answer: 'DTMS menerapkan multi-tenant isolation, RBAC 9 level, audit log, rate limiting, dan opsi 2FA TOTP. Setiap tenant memiliki isolasi data yang ketat.',
  },
];

export const PRICING_PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Coba gratis selamanya.',
    price: 'Gratis',
    period: null,
    popular: false,
    cta: 'Mulai Gratis',
    features: [
      '3 user aktif',
      '5 driver',
      '50 pengiriman/bulan',
      'Basic tracking & dispatch',
      '1 cabang',
      '50 MB storage',
    ],
  },
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'Untuk bisnis kecil yang mulai digitalisasi.',
    price: 'Rp 199rb',
    period: 'bulan',
    popular: false,
    cta: 'Mulai Sekarang',
    features: [
      '5 user aktif',
      '15 driver',
      '500 pengiriman/bulan',
      'Live GPS tracking',
      '2 cabang, 2 hub',
      'Laporan & analytics',
      'Trial 14 hari',
    ],
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    description: 'Untuk logistik menengah yang berkembang.',
    price: 'Rp 449rb',
    period: 'bulan',
    popular: true,
    cta: 'Mulai Sekarang',
    features: [
      '15 user aktif',
      '40 driver',
      '2.000 pengiriman/bulan',
      'Geofencing & warehouse',
      '10 cabang, 10 hub',
      '3 organisasi',
      'Trial 14 hari',
    ],
  },
  {
    code: 'PRO',
    name: 'Professional',
    description: 'Untuk tim operasional dengan kebutuhan penuh.',
    price: 'Rp 899rb',
    period: 'bulan',
    popular: false,
    cta: 'Hubungi Sales',
    features: [
      '50 user aktif',
      '150 driver',
      '10.000 pengiriman/bulan',
      'SLA, ETA & Control Tower',
      'Unlimited cabang & hub',
      'API & Webhooks',
      'Laporan harian',
      'Trial 30 hari',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Solusi lengkap untuk korporasi besar.',
    price: 'Rp 2.5jt',
    period: 'bulan',
    popular: false,
    cta: 'Hubungi Sales',
    features: [
      'Unlimited user & driver',
      'Unlimited pengiriman',
      'Analytics advanced',
      'Integrasi WhatsApp & API',
      'White-label branding',
      '20 GB storage',
      'Priority support',
      'Trial 30 hari',
    ],
  },
];
