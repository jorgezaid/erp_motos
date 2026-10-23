'use client';

import { BotonConfirmar } from '@/components/confirmar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Decimal } from '@/lib/decimal';
import { totalesCompra } from '@/lib/costing/compra-local';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { eliminarLinea } from '../acciones';
import { DialogoItem } from './dialogo-item';

export type ItemVista = {
  id: string;
  model_id: string;
  codigo_modelo: string;
  cantidad_packing_list: number;
  precio_compra_unitario_pen: number | null;
  registradas: number;
};

/** Pestaña Ítems de una compra local (D41): modelo, cantidad, precio unitario y subtotal en soles. */
export function TablaItems({
  batchId,
  items,
  disponibles,
  liquidado,
  incluyeIgv,
}: {
  batchId: string;
  items: ItemVista[];
  disponibles: { id: string; codigo_modelo: string }[];
  liquidado: boolean;
  incluyeIgv: boolean;
}) {
  const t = totalesCompra(items);

  return (
    <div className="grid gap-4">
      {!liquidado && (
        <div>
          <DialogoItem
            batchId={batchId}
            modelos={disponibles}
            incluyeIgv={incluyeIgv}
            disparador={<Button disabled={disponibles.length === 0}>Agregar modelo</Button>}
          />
          {disponibles.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No quedan modelos activos por agregar. Créalos en Administración → Modelos.
            </p>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Registradas</TableHead>
              <TableHead className="text-right">Precio unit. {incluyeIgv ? '(con IGV)' : '(sin IGV)'}</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {!liquidado && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  La compra no tiene ítems.
                </TableCell>
              </TableRow>
            )}
            {items.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.codigo_modelo}</TableCell>
                <TableCell className="text-right">{l.cantidad_packing_list}</TableCell>
                <TableCell className="text-right">{l.registradas}</TableCell>
                <TableCell className="text-right">{formatPEN(l.precio_compra_unitario_pen)}</TableCell>
                <TableCell className="text-right">
                  {formatPEN(new Decimal(l.precio_compra_unitario_pen ?? 0).times(l.cantidad_packing_list).toFixed(2))}
                </TableCell>
                {!liquidado && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <DialogoItem
                        batchId={batchId}
                        itemId={l.id}
                        codigo={l.codigo_modelo}
                        incluyeIgv={incluyeIgv}
                        inicial={{
                          model_id: l.model_id,
                          cantidad_packing_list: String(l.cantidad_packing_list),
                          precio_compra_unitario_pen:
                            l.precio_compra_unitario_pen === null ? '' : String(l.precio_compra_unitario_pen),
                        }}
                        disparador={
                          <Button variant="outline" size="sm" aria-label={`Editar ${l.codigo_modelo}`}>
                            Editar
                          </Button>
                        }
                      />
                      <BotonConfirmar
                        etiqueta="Quitar"
                        variante="outline"
                        deshabilitado={l.registradas > 0}
                        titulo={`¿Quitar ${l.codigo_modelo} de la compra?`}
                        descripcion="Se borrará el costeo guardado y habrá que recalcularlo."
                        confirmar="Quitar"
                        alConfirmar={async () =>
                          avisar(await eliminarLinea(batchId, l.id), `${l.codigo_modelo} quitado`)
                        }
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          {items.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right" data-testid="total-unidades">
                  {t.unidades}
                </TableCell>
                <TableCell className="text-right">{items.reduce((s, l) => s + l.registradas, 0)}</TableCell>
                <TableCell />
                <TableCell className="text-right" data-testid="total-compra">
                  {formatPEN(t.total)}
                </TableCell>
                {!liquidado && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
