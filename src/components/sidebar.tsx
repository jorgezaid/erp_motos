'use client';

import {
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  Ship,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cerrarSesion } from '@/app/(auth)/acciones';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { moduloActivo, type Modulo } from '@/lib/navegacion';
import { cn } from '@/lib/utils';

const ICONOS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/lotes': Ship,
  '/inventario': Warehouse,
  '/taller': Wrench,
  '/precios': Tags,
  '/ventas': ShoppingCart,
  '/garantias': ShieldCheck,
  '/auditoria': ClipboardCheck,
  '/gastos': Receipt,
  '/admin/usuarios': Users,
  '/admin/modelos': Boxes,
  '/admin/ubicaciones': MapPin,
  '/admin/proveedores': Truck,
};

type Props = { modulos: Modulo[]; nombre: string; rol: string };

function Enlaces({ modulos, alNavegar }: { modulos: Modulo[]; alNavegar?: () => void }) {
  const pathname = usePathname();
  const activo = moduloActivo(pathname, modulos);
  const grupos = [
    { titulo: null, items: modulos.filter((m) => m.grupo === 'operacion') },
    { titulo: 'Administración', items: modulos.filter((m) => m.grupo === 'administracion') },
  ];

  return (
    <nav className="grid gap-4" aria-label="Módulos">
      {grupos
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.titulo ?? 'principal'} className="grid gap-1">
            {g.titulo && <p className="px-3 text-xs font-medium uppercase text-muted-foreground">{g.titulo}</p>}
            {g.items.map((m) => {
              const Icono = ICONOS[m.href] ?? LayoutDashboard;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={alNavegar}
                  aria-current={activo === m.href ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent',
                    activo === m.href && 'bg-accent font-medium',
                  )}
                >
                  <Icono className="size-4" aria-hidden />
                  {m.etiqueta}
                </Link>
              );
            })}
          </div>
        ))}
    </nav>
  );
}

function Usuario({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <div className="grid gap-2 border-t pt-4">
      <div className="px-3 text-sm">
        <p className="font-medium">{nombre}</p>
        <p className="text-muted-foreground">{rol}</p>
      </div>
      <form action={cerrarSesion}>
        <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}

export function Sidebar({ modulos, nombre, rol }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between overflow-y-auto border-r bg-sidebar p-4 print:hidden md:flex">
        <div className="grid gap-6">
          <Link href="/" className="px-3 text-lg font-semibold">
            ERP Motos
          </Link>
          <Enlaces modulos={modulos} />
        </div>
        <Usuario nombre={nombre} rol={rol} />
      </aside>

      {/* Móvil (el técnico trabaja desde el celular) */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background px-4 py-2 print:hidden md:hidden">
        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col justify-between p-4">
            <div className="grid gap-6">
              <SheetHeader className="p-0">
                <SheetTitle>ERP Motos</SheetTitle>
              </SheetHeader>
              <Enlaces modulos={modulos} alNavegar={() => setAbierto(false)} />
            </div>
            <Usuario nombre={nombre} rol={rol} />
          </SheetContent>
        </Sheet>
        <span className="font-semibold">ERP Motos</span>
      </header>
    </>
  );
}
