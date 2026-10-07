import { Sidebar } from '@/components/sidebar';
import { exigirRol } from '@/lib/auth';
import { modulosPara } from '@/lib/navegacion';
import { ETIQUETA_ROL } from '@/lib/roles';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await exigirRol();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        modulos={modulosPara(sesion.rol)}
        nombre={sesion.nombre || sesion.email}
        rol={ETIQUETA_ROL[sesion.rol]}
      />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
