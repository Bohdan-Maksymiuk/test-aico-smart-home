import { DeviceListPage } from '@/devices/DeviceListPage';
import { Toaster } from '@/ui/Sonner';

export function App() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Smart Home</h1>
      </header>
      <main>
        <DeviceListPage />
      </main>
      <Toaster />
    </div>
  );
}
