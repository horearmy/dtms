"use client";

export async function getGPS(): Promise<{ lat: number; lng: number }> {
  // pakai geolocation bila tersedia, bila tidak gunakan simulasi
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      // lanjut simulasi
    }
  }
  return {
    lat: -6.2 + (Math.random() - 0.5) * 0.04,
    lng: 106.816 + (Math.random() - 0.5) * 0.04,
  };
}