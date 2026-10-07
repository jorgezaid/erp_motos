import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormularioLogin } from './formulario-login';

export const metadata: Metadata = { title: 'Ingresar · ERP Vehículos Eléctricos' };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">ERP Vehículos Eléctricos</CardTitle>
          <CardDescription>Ingresa con tu email y contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioLogin next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
