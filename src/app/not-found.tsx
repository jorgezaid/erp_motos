import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-muted-foreground">El registro no existe o no tienes acceso a él.</p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
