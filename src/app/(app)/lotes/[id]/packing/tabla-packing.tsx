'use client';

import { TriangleAlert } from 'lucide-react';
import { BotonConfirmar } from '@/components/confirmar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { difiereDeDam, totalesLinea, totalesPacking } from '@/lib/costing/packing';
import { formatNumero, formatUSD } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { eliminarLinea } from '../acciones';
import { DialogoLinea, type ModeloCatalogo } from './dialogo-linea';

export type LineaVista = {
  id: string;
  model_id: string;
  codigo_modelo: string;
  cantidad_packing_list: number;
  cantidad_dam: number | null;
  exw_usd_unitario: number;
  volumen_cbm_unitario: number;
  registradas: number;
};

export function TablaPacking({
  batchId,
  lineas,
  disponibles,
  liquidado,
}: {
  batchId: string;
  lineas: LineaVista[];
  disponibles: ModeloCatalogo[];
  liquidado: boolean;
}) {
  const t = totalesPacking(lineas);

  return (
    <div className="grid gap-4">
      {!liquidado && (
        <div>
          <DialogoLinea
            batchId={batchId}
            modelos={disponibles}
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
              <TableHead className="text-right">Packing list</TableHead>
              <TableHead className="text-right">DAM</TableHead>
              <TableHead className="text-right">Registradas</TableHead>
              <TableHead className="text-right">EXW unit.</TableHead>
              <TableHead className="text-right">EXW total</TableHead>
              <TableHead className="text-right">CBM unit.</TableHead>
              <TableHead className="text-right">CBM total</TableHead>
              {!liquidado && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                  El packing list está vacío.
                </TableCell>
              </TableRow>
            )}
            {lineas.map((l) => {
              const tl = totalesLinea(l);
              const alerta = difiereDeDam(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.codigo_modelo}</TableCell>
                  <TableCell className="text-right">{l.cantidad_packing_list}</TableCell>
                  <TableCell className={alerta ? 'text-right font-medium text-destructive' : 'text-right'}>
                    {alerta && <TriangleAlert className="mr-1 inline size-4" aria-label="Difiere del packing list" />}
                    {l.cantidad_dam ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">{l.registradas}</TableCell>
                  <TableCell className="text-right">{formatUSD(l.exw_usd_unitario)}</TableCell>
                  <TableCell className="text-right">{formatUSD(tl.exw)}</TableCell>
                  <TableCell className="text-right">{formatNumero(l.volumen_cbm_unitario, 4)}</TableCell>
                  <TableCell className="text-right">{formatNumero(tl.cbm, 4)}</TableCell>
                  {!liquidado && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <DialogoLinea
                          batchId={batchId}
                          itemId={l.id}
                          codigo={l.codigo_modelo}
                          inicial={{
                            model_id: l.model_id,
                            cantidad_packing_list: String(l.cantidad_packing_list),
                            cantidad_dam: l.cantidad_dam === null ? '' : String(l.cantidad_dam),
                            exw_usd_unitario: String(l.exw_usd_unitario),
                            volumen_cbm_unitario: String(l.volumen_cbm_unitario),
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
                          titulo={`¿Quitar ${l.codigo_modelo} del packing list?`}
                          descripcion="Se borrará el costeo guardado del lote y habrá que recalcularlo."
                          confirmar="Quitar"
                          alConfirmar={async () => avisar(await eliminarLinea(batchId, l.id), `${l.codigo_modelo} quitado`)}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
          {lineas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right" data-testid="total-unidades">
                  {t.unidades}
                </TableCell>
                <TableCell className="text-right">{t.unidadesDam ?? '—'}</TableCell>
                <TableCell className="text-right">{lineas.reduce((s, l) => s + l.registradas, 0)}</TableCell>
                <TableCell />
                <TableCell className="text-right" data-testid="total-exw">
                  {formatUSD(t.exw)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right" data-testid="total-cbm">
                  {formatNumero(t.cbm, 4)}
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
