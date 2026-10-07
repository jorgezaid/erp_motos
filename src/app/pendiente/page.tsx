import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { obtenerSesion } from '@/lib/auth';
import { cerrarSesion } from '../(auth)/acciones';

export const metadata: Metadata = { title: 'Cuenta pendiente · ERP Vehículos Eléctricos' };

export default async function PaginaPendiente() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  if (sesion.rol) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Tu cuenta espera aprobación</CardTitle>
          <CardDescription>
            Ingresaste como <strong>{sesion.email}</strong>. Un administrador debe asignarte un rol (o reactivar tu
            cuenta) para que puedas usar el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={cerrarSesion}>
            <Button type="submit" variant="outline">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
