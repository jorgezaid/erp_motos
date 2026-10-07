'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTransition } from 'react';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { formatFecha } from '@/lib/format';
import { ETIQUETA_ROL, ROLES, type Rol } from '@/lib/roles';
import { avisar } from '@/lib/toast';
import { asignarRol, cambiarActivo } from './acciones';

type Usuario = { id: string; email: string; nombre: string; rol: Rol | null; activo: boolean; created_at: string };

const SIN_ROL = '__sin_rol__';

function CeldaRol({ usuario, esYo }: { usuario: Usuario; esYo: boolean }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <Select
      value={usuario.rol ?? SIN_ROL}
      disabled={pendiente || esYo}
      onValueChange={(v) =>
        startTransition(async () => {
          const rol = v === SIN_ROL ? null : (v as Rol);
          avisar(await asignarRol({ id: usuario.id, rol }), `Rol de ${usuario.email} actualizado`);
        })
      }
    >
      <SelectTrigger className="w-44" aria-label={`Rol de ${usuario.email}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_ROL}>Sin rol</SelectItem>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ETIQUETA_ROL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CeldaActivo({ usuario, esYo }: { usuario: Usuario; esYo: boolean }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <Switch
      checked={usuario.activo}
      disabled={pendiente || esYo}
      aria-label={`Cuenta de ${usuario.email} activa`}
      onCheckedChange={(activo) =>
        startTransition(async () => {
          avisar(
            await cambiarActivo({ id: usuario.id, activo }),
            activo ? `Cuenta de ${usuario.email} activada` : `Cuenta de ${usuario.email} desactivada`,
          );
        })
      }
    />
  );
}

export function TablaUsuarios({ usuarios, yo }: { usuarios: Usuario[]; yo: string }) {
  const columnas: ColumnDef<Usuario, unknown>[] = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <span>
          {row.original.nombre || '—'} {row.original.id === yo && <Badge variant="outline">tú</Badge>}
        </span>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'rol',
      header: 'Rol',
      enableSorting: false,
      cell: ({ row }) => <CeldaRol usuario={row.original} esYo={row.original.id === yo} />,
    },
    {
      id: 'activo',
      header: 'Activa',
      enableSorting: false,
      cell: ({ row }) => <CeldaActivo usuario={row.original} esYo={row.original.id === yo} />,
    },
    { accessorKey: 'created_at', header: 'Alta', cell: ({ row }) => formatFecha(row.original.created_at) },
  ];
  return <TablaDatos columnas={columnas} filas={usuarios} vacio="No hay usuarios con esos filtros." />;
}
