import type { Metadata } from 'next';
import OrdersList from './OrdersList';

export const metadata: Metadata = { title: 'Orders | DTMS' };

export default function OrdersPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Orders</h1>
          <p className="mt-1 text-sm text-[#667085]">Kelola pesanan masuk sebelum menjadi pengiriman.</p>
        </div>
      </div>
      <OrdersList />
    </div>
  );
}
