'use client';

import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Decimal } from '@/lib/decimal';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { formatPorcentaje, fraccionDescuento, margenResultante, precioMinimoVendedor } from '@/lib/ventas';
import { ajustarPrecio } from '../acciones';

/**
 * Lo que cada rol puede ver al ajustar (RN-25). El vendedor solo su límite %; el costo landing
 * solo llega aquí si la sesión es de admin.
 */
export type LimiteDescuento = { rol: 'vendedor'; descuentoMax: number } | { rol: 'admin'; costo: number | null };

/** Precio de la caja de texto como Decimal, o null si no es un monto válido. */
function leerPrecio(texto: string): Decimal | null {
  const v = texto.replace(/\s/g, '').replace(',', '.');
  return /^\d{1,12}(\.\d{1,2})?$/.test(v) ? new Decimal(v) : null;
}

/** RN-25: precio final de una moto de la orden (solo baja; motivo si queda bajo la lista). */
export function DialogoPrecioFinal({
  orderId,
  itemId,
  vin,
  lista,
  precio,
  motivo,
  limite,
  deshabilitado,
}: {
  orderId: string;
  itemId: string;
  vin: string;
  lista: number;
  precio: number;
  motivo: string | null;
  limite: LimiteDescuento;
  deshabilitado?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [texto, setTexto] = useState(String(precio));
  const [razon, setRazon] = useState(motivo ?? '');

  const valor = leerPrecio(texto);
  const conDescuento = valor !== null && valor.lt(lista);
  const supera = valor !== null && valor.gt(lista);
  const minimoVendedor = limite.rol === 'vendedor' ? precioMinimoVendedor(lista, limite.descuentoMax) : null;
  const excedeLimite = minimoVendedor !== null && valor !== null && valor.lt(minimoVendedor);
  const bajoCosto = limite.rol === 'admin' && limite.costo !== null && valor !== null && valor.lt(limite.costo);

  function abrir(a: boolean) {
    if (a) {
      setTexto(String(precio));
      setRazon(motivo ?? '');
    }
    setAbierto(a);
  }

  function guardar(nuevo: string, nuevoMotivo: string) {
    startTransition(async () => {
      const r = await ajustarPrecio(orderId, itemId, { precio: nuevo, motivo: nuevoMotivo });
      if (avisar(r, `Precio de ${vin} actualizado`)) {
        setAbierto(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Precio final de ${vin}`} disabled={deshabilitado}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Precio final</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{vin}</span> · precio de lista {formatPEN(lista)}. Solo se puede bajar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            guardar(texto, conDescuento ? razon : '');
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`precio-final-${itemId}`}>Precio final (S/)</Label>
            <Input
              id={`precio-final-${itemId}`}
              inputMode="decimal"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-describedby={`precio-final-ayuda-${itemId}`}
            />
            <div id={`precio-final-ayuda-${itemId}`} className="grid gap-1 text-sm" aria-live="polite">
              {conDescuento && valor && (
                <p>
                  Descuento: {formatPEN(new Decimal(lista).minus(valor).toFixed(2))} (
                  {formatPorcentaje(fraccionDescuento(lista, valor.toFixed(2)))})
                </p>
              )}
              {supera && <p className="text-destructive">No puede superar el precio de lista.</p>}
              {limite.rol === 'vendedor' && (
                <p className={cn(excedeLimite ? 'text-destructive' : 'text-muted-foreground')}>
                  {excedeLimite
                    ? `Supera tu descuento máximo (${formatPorcentaje(limite.descuentoMax)}): necesita autorización del administrador.`
                    : `Puedes descontar hasta ${formatPorcentaje(limite.descuentoMax)} (precio desde ${formatPEN(minimoVendedor)}).`}
                </p>
              )}
              {limite.rol === 'admin' &&
                (limite.costo === null ? (
                  <p className="text-muted-foreground">Sin costo landing registrado.</p>
                ) : (
                  <p className={cn(bajoCosto ? 'text-destructive' : 'text-muted-foreground')} data-testid="minimo-admin">
                    Mínimo (costo landing): {formatPEN(limite.costo)}
                    {valor !== null && valor.gt(0) && ` · margen resultante: ${formatPorcentaje(margenResultante(valor.toFixed(2), limite.costo))}`}
                    {bajoCosto && ' · por debajo del costo'}
                  </p>
                ))}
            </div>
          </div>
          {conDescuento && (
            <div className="grid gap-1.5">
              <Label htmlFor={`motivo-ajuste-${itemId}`}>Motivo del descuento (obligatorio)</Label>
              <Textarea id={`motivo-ajuste-${itemId}`} value={razon} onChange={(e) => setRazon(e.target.value)} maxLength={300} />
            </div>
          )}
          <DialogFooter>
            {precio !== lista && (
              <Button type="button" variant="outline" disabled={pendiente} onClick={() => guardar(String(lista), '')}>
                Volver al precio de lista
              </Button>
            )}
            <Button type="submit" disabled={pendiente || valor === null || supera || excedeLimite || bajoCosto}>
              {pendiente ? 'Guardando…' : 'Guardar precio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
