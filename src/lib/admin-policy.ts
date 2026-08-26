/**
 * Kebijakan autentikasi Superadmin — sumber tunggal (Blueprint §33).
 * Jangan hard-code nilai keamanan di banyak file.
 *
 * ADMIN_REQUIRE_MFA=true  → login SA tanpa TOTP terdaftar akan ditolak.
 * Default false agar migrasi bertahap; aktifkan setelah semua SA enroll.
 */
export const ADMIN_AUTH_POLICY = {
  requireMFA: process.env.ADMIN_REQUIRE_MFA === 'true',

  /** Panjang sesi privileged (Blueprint §34: absolute 8 jam) */
  maxSessionMinutes: Number(process.env.ADMIN_SESSION_MINUTES || 240),

  /** Idle timeout — sesi mati jika tak ada aktivitas (Blueprint §34: 20 menit) */
  idleTimeoutMinutes: Number(process.env.ADMIN_IDLE_MINUTES || 20),

  /** Jeda minimal penulisan lastActivityAt agar tidak write-storm (ms) */
  activityWriteThrottleMs: 60 * 1000,

  /** Lockout akun: percobaan gagal sebelum terkunci (per username) */
  accountMaxAttempts: 5,
  /** Window penghitungan kegagalan akun (ms) */
  accountWindowMs: 15 * 60 * 1000,
  /** Delay progresif awal saat terkunci (ms), berlipat tiap pelanggaran, maks 15 menit */
  accountLockBaseMs: 30 * 1000,
  accountLockMaxMs: 15 * 60 * 1000,

  /** Masa aktif token MFA antara step-2 dan step-3 (ms) */
  mfaTokenTtlMs: 5 * 60 * 1000,

  /** Step-up authentication (Blueprint §20): masa aktif token verifikasi ulang */
  stepUpTtlMinutes: Number(process.env.ADMIN_STEPUP_MINUTES || 5),
} as const;

/** Aksi kritis yang mewajibkan step-up (Blueprint §20/§34 privileged.requireStepUpFor) */
export const CRITICAL_ACTIONS = {
  TENANT_LIFECYCLE: 'tenant_suspend',
  BILLING_CHANGE_PLAN: 'billing_change',
} as const;
