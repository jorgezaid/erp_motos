import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { ETIQUETA_ROL } from '@/lib/roles';
import { cerrarSesion } from '../(auth)/acciones';

export default async function Inicio() {
  const sesion = await exigirRol();
  return (
    <main className="grid gap-4 p-8">
      <h1 className="text-2xl font-semibold">Hola, {sesion.nombre || sesion.email}</h1>
      <p className="text-muted-foreground">Rol: {ETIQUETA_ROL[sesion.rol]}</p>
      <form action={cerrarSesion}>
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
