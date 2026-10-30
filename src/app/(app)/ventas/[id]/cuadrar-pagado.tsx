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
import { formatPorcentaje, fraccionDescuento, fraccionSobreLista, precioMaximoSobreLista, repartirAjuste } from '@/lib/ventas';
import { cuadrarConPagado } from '../acciones';
import type { ItemOrden } from './editor-orden';
import type { LimiteDescuento } from './precio-final';

/**
 * RN-25 y D43, atajo junto al saldo: si se cobró menos que el total, aplica la diferencia como
 * descuento; si se cobró más, como aumento. Se reparte entre las motos (proporcional al precio)
 * y deja el saldo en 0. La vista previa es solo para la UX: el servidor recalcula el reparto y
 * la BD aplica los límites.
 */
export function BotonCuadrarConPagado({
  orderId,
  items,
  pagado,
  rol,
  descuentoMax,
  aumentoMax,
}: {
  orderId: string;
  items: ItemOrden[];
  pagado: string;
  rol: LimiteDescuento['rol'];
  descuentoMax: number;
  aumentoMax: number;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState('');
  const reparto = repartirAjuste(items, pagado);
  if (!reparto) return null;
  const aumento = reparto.tipo === 'aumento';

  // repartirAjuste conserva el orden de `items`
  const filas = items.flatMap((item, k) => {
    const r = reparto.filas[k];
    if (!r) return [];
    const precio = new Decimal(r.precio);
    return [
      {
        ...r,
        item,
        // Respecto de la lista: un aumento puede dejar una moto con descuento previo aún bajo la lista
        texto: precio.gt(item.lista)
          ? `+${formatPorcentaje(fraccionSobreLista(item.lista, r.precio))} sobre la lista`
          : `${formatPorcentaje(fraccionDescuento(item.lista, r.precio))} de la lista`,
        excede: rol === 'vendedor' && new Decimal(fraccionDescuento(item.lista, r.precio)).gt(descuentoMax),
        bajoCosto: rol === 'admin' && item.costo != null && precio.lt(item.costo),
        sobreTope: precio.gt(precioMaximoSobreLista(item.lista, aumentoMax)),
      },
    ];
  });
  const excede = filas.some((f) => f.excede);
  const bajoCosto = filas.some((f) => f.bajoCosto);
  const sobreTope = filas.some((f) => f.sobreTope);
  const monto = formatPEN(reparto.monto);

  return (
    <div className="grid gap-2">
      <BotonConfirmar
        etiqueta={aumento ? `Ajustar precio a lo pagado (+${monto})` : `Aplicar descuento de ${monto} y cuadrar con lo pagado`}
        variante="outline"
        deshabilitado={excede || bajoCosto || sobreTope}
        titulo={aumento ? `¿Subir el precio en ${monto}?` : `¿Aplicar un descuento de ${monto}?`}
        descripcion={
          <p>
            {aumento ? 'El aumento' : 'El descuento'} se reparte entre las {items.length} moto(s) en proporción a su precio, y el
            total queda en {formatPEN(pagado)} (lo pagado). Luego podrás confirmar la venta.
          </p>
        }
        confirmar={aumento ? 'Ajustar precio' : 'Aplicar descuento'}
        alConfirmar={async () => {
          const r = await cuadrarConPagado(orderId, motivo);
          const ok = avisar(
            r,
            r.ok
              ? `${r.datos.tipo === 'aumento' ? 'Precio ajustado' : 'Descuento'} (${r.datos.tipo === 'aumento' ? '+' : '−'}${formatPEN(r.datos.monto)}): saldo en S/ 0.00`
              : undefined,
          );
          if (ok) {
            setMotivo('');
            router.refresh();
          }
          return ok;
        }}
      >
        <div className="max-h-48 overflow-auto rounded-md border">
          <Table aria-label={aumento ? 'Reparto del aumento' : 'Reparto del descuento'}>
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
                    <span className="block text-xs text-muted-foreground">{f.texto}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="motivo-cuadrar">{aumento ? 'Motivo del precio sobre la lista (obligatorio)' : 'Motivo del descuento (obligatorio)'}</Label>
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
      {sobreTope && (
        <p className="text-sm text-destructive" data-testid="cuadrar-sobre-tope">
          Con lo pagado, alguna moto superaría en más de {formatPorcentaje(aumentoMax)} su precio de lista. Revisa los pagos.
        </p>
      )}
    </div>
  );
}
