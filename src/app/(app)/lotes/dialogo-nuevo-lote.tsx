'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { OpcionProveedor } from '@/lib/consultas/proveedores';
import { esquemaNuevoLote } from '@/lib/esquemas/lote';
import { avisar } from '@/lib/toast';
import { crearLote } from './acciones';

export function DialogoNuevoLote({ proveedores }: { proveedores: OpcionProveedor[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaNuevoLote), defaultValues: { codigo_embarque: '', proveedor_id: '' } });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      const r = await crearLote(valores);
      if (avisar(r, 'Lote creado')) {
        setAbierto(false);
        router.push(`/lotes/${r.datos.id}`);
      }
    });
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>Nuevo lote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo lote de importación</DialogTitle>
          <DialogDescription>Los costos, la DAM y el packing list se completan después en sus pestañas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CampoTexto
            etiqueta="Código de embarque"
            registro={register('codigo_embarque')}
            error={errors.codigo_embarque?.message}
            placeholder="117GZH2606089"
          />
          <CampoSelect
            control={control}
            nombre="proveedor_id"
            etiqueta="Proveedor"
            opciones={proveedores}
            error={errors.proveedor_id?.message}
            placeholder="Sin proveedor"
          />
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Creando…' : 'Crear lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
