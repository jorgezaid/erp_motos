'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Printer } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { BotonConfirmar } from '@/components/confirmar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { avisar } from '@/lib/toast';
import { esquemaCliente, type EntradaCliente } from '@/lib/ventas';
import { actualizarCliente, anularOrden } from '../acciones';
import { CamposCliente } from '../campos-cliente';

export function BotonImprimir() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Imprimir nota de venta
    </Button>
  );
}

/** RN-17: en una venta confirmada solo se corrigen el teléfono y el email. */
export function DialogoContacto({ orderId, inicial }: { orderId: string; inicial: EntradaCliente }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaCliente), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await actualizarCliente(orderId, valores), 'Contacto actualizado')) setAbierto(false);
    });
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar contacto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contacto del cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CamposCliente register={register} control={control} errors={errors} soloContacto />
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Anular (solo admin, con motivo obligatorio). */
export function BotonAnular({ orderId, numero }: { orderId: string; numero: number }) {
  const [motivo, setMotivo] = useState('');
  return (
    <BotonConfirmar
      etiqueta="Anular"
      variante="destructive"
      titulo={`¿Anular la venta #${numero}?`}
      descripcion="Las unidades vuelven a tienda y sus garantías se anulan (RN-17). El monto queda como histórico."
      confirmar="Anular venta"
      alConfirmar={async () => avisar(await anularOrden({ orderId, motivo }), `Venta #${numero} anulada`)}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="motivo-anulacion">Motivo (obligatorio)</Label>
        <Textarea id="motivo-anulacion" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </BotonConfirmar>
  );
}
