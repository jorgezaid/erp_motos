'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BotonConfirmar } from '@/components/confirmar';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Decimal } from '@/lib/decimal';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { formatPorcentaje, fraccionDescuento, repartirDescuento, sumar } from '@/lib/ventas';
import { cuadrarConPagado } from '../acciones';
import type { ItemOrden } from './editor-orden';
import type { LimiteDescuento } from './precio-final';

/**
 * RN-25, atajo junto al saldo: si se cobró menos que el total, aplica la diferencia como
 * descuento repartido entre las motos (proporcional al precio) y deja el saldo en 0.
 * La vista previa es solo para la UX: el servidor recalcula el reparto y la BD aplica los límites.
 */
export function BotonCuadrarConPagado({
  orderId,
  items,
  pagado,
  rol,
  descuentoMax,
}: {
  orderId: string;
  items: ItemOrden[];
  pagado: string;
  rol: LimiteDescuento['rol'];
  descuentoMax: number;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState('');
  const reparto = repartirDescuento(items, pagado);
  if (!reparto) return null;

  // repartirDescuento conserva el orden de `items`
  const filas = items.flatMap((item, k) => {
    const r = reparto[k];
    if (!r) return [];
    const fraccion = fraccionDescuento(item.lista, r.precio);
    return [
      {
        ...r,
        item,
        fraccion,
        excede: rol === 'vendedor' && new Decimal(fraccion).gt(descuentoMax),
        bajoCosto: rol === 'admin' && item.costo != null && new Decimal(r.precio).lt(item.costo),
      },
    ];
  });
  const descuento = sumar(reparto.map((r) => r.descuento));
  const excede = filas.some((f) => f.excede);
  const bajoCosto = filas.some((f) => f.bajoCosto);

  return (
    <div className="grid gap-2">
      <BotonConfirmar
        etiqueta={`Aplicar descuento de ${formatPEN(descuento)} y cuadrar con lo pagado`}
        variante="outline"
        deshabilitado={excede || bajoCosto}
        titulo={`¿Aplicar un descuento de ${formatPEN(descuento)}?`}
        descripcion={
          <p>
            El descuento se reparte entre las {items.length} moto(s) en proporción a su precio, y el total queda en{' '}
            {formatPEN(pagado)} (lo pagado). Luego podrás confirmar la venta.
          </p>
        }
        confirmar="Aplicar descuento"
        alConfirmar={async () => {
          const r = await cuadrarConPagado(orderId, motivo);
          const ok = avisar(r, r.ok ? `Descuento de ${formatPEN(r.datos.descuento)} aplicado: saldo en S/ 0.00` : undefined);
          if (ok) {
            setMotivo('');
            router.refresh();
          }
          return ok;
        }}
      >
        <div className="max-h-48 overflow-auto rounded-md border">
          <Table aria-label="Reparto del descuento">
            <TableHeader>
              <TableRow>
                <TableHead>VIN</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead className="text-right">Precio final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono">{f.item.vin}</TableCell>
                  <TableCell className="text-right">{formatPEN(f.item.precio)}</TableCell>
                  <TableCell className="text-right">
                    {formatPEN(f.precio)}
                    <span className="block text-xs text-muted-foreground">{formatPorcentaje(f.fraccion)} de la lista</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="motivo-cuadrar">Motivo del descuento (obligatorio)</Label>
          <Textarea id="motivo-cuadrar" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        </div>
      </BotonConfirmar>
      {excede && (
        <p className="text-sm text-destructive" data-testid="cuadrar-excede">
          Ese descuento supera tu máximo de {formatPorcentaje(descuentoMax)} por moto: necesita autorización del administrador.
        </p>
      )}
      {bajoCosto && (
        <p className="text-sm text-destructive" data-testid="cuadrar-bajo-costo">
          Con lo pagado, alguna moto quedaría por debajo de su costo landing.
        </p>
      )}
    </div>
  );
}
