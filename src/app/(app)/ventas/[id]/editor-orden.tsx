'use client';

import { Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BotonConfirmar } from '@/components/confirmar';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { RadioOpciones } from '@/components/formulario/radio-opciones';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Decimal } from '@/lib/decimal';
import type { Resultado } from '@/lib/errores';
import { mostrarSelectorEscala } from '@/lib/escalas';
import { METODO_PAGO, opciones, TIPO_LOTE, TIPO_VENTA, type TipoLote } from '@/lib/etiquetas';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  faltanParaEscala,
  formatPorcentaje,
  fraccionDescuento,
  metodoDerivado,
  motivosNoConfirmable,
  saldoPendiente,
  sumar,
  type MetodoPago,
  type TipoVenta,
} from '@/lib/ventas';
import {
  agregarUnidad,
  buscarUnidades,
  cambiarTipoVenta,
  confirmarOrden,
  eliminarOrden,
  eliminarPago,
  quitarUnidad,
  registrarPago,
  type BusquedaUnidades,
} from '../acciones';
import { BotonCuadrarConPagado } from './cuadrar-pagado';
import { DialogoPrecioFinal } from './precio-final';

export type ItemOrden = {
  id: string;
  vin: string;
  modelo: string;
  colores: string;
  precio: number;
  /** Precio de la lista (RN-13); `precio` es el final, igual o menor (RN-25). */
  lista: number;
  motivo: string | null;
  /** Costo landing: solo en la sesión de admin (nunca se serializa para el vendedor). */
  costo?: number | null;
};
export type PagoOrden = { id: string; metodo: MetodoPago; monto_pen: number; referencia: string | null };

/** Pasos 2 a 5 del POS (SPEC M6) sobre una orden en borrador. */
export function EditorOrden({
  orderId,
  numero,
  tipo,
  total,
  items,
  pagos,
  minimos,
  activas,
  esAdmin,
  descuentoMax,
}: {
  orderId: string;
  numero: number;
  tipo: TipoVenta;
  total: number;
  items: ItemOrden[];
  pagos: PagoOrden[];
  minimos: Record<TipoVenta, number>;
  /** Escalas activas (D31): solo esas se ofrecen y solo para ellas se avisa "Faltan N unidades". */
  activas: TipoVenta[];
  esAdmin: boolean;
  /** RN-25: descuento máximo del vendedor por moto (fracción). */
  descuentoMax: number;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState('');
  const [origen, setOrigen] = useState<TipoLote | 'todos'>('todos');
  const [resultados, setResultados] = useState<BusquedaUnidades | null>(null);
  const [pago, setPago] = useState<{ metodo: MetodoPago; monto: string; referencia: string }>({
    metodo: 'efectivo',
    monto: '',
    referencia: '',
  });

  const minimo = minimos[tipo];
  const activa = activas.includes(tipo);
  const pagado = sumar(pagos.map((p) => p.monto_pen));
  const saldo = saldoPendiente(total, pagos);
  const saldoDecimal = new Decimal(saldo);
  const faltan = activa ? faltanParaEscala(tipo, items.length, minimo) : null;
  const motivos = motivosNoConfirmable({ tipo, unidades: items.length, minimo, total, pagos, activa });
  const metodo = metodoDerivado(pagos);
  const enOrden = new Set(items.map((i) => i.vin));

  function accion(fn: () => Promise<Resultado>, exito?: string, despues?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (avisar(r, exito)) {
        despues?.();
        router.refresh();
      }
    });
  }

  function buscar() {
    startTransition(async () => {
      const r = await buscarUnidades(busqueda, tipo, origen === 'todos' ? '' : origen);
      if (avisar(r)) setResultados(r.datos);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tipo de venta</CardTitle>
            <CardDescription>
              {mostrarSelectorEscala(activas, tipo)
                ? 'Si lo cambias, todas las unidades se vuelven a cotizar (RN-13).'
                : 'Es la única escala de venta activa.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!activa && (
              <Alert variant="destructive">
                <AlertDescription data-testid="escala-desactivada">
                  La escala {TIPO_VENTA[tipo]} está desactivada: elige otra para poder confirmar.
                </AlertDescription>
              </Alert>
            )}
            {mostrarSelectorEscala(activas, tipo) ? (
              <RadioOpciones
                nombre="tipo_venta"
                valor={tipo}
                deshabilitado={pendiente}
                alCambiar={(v) => accion(() => cambiarTipoVenta(orderId, v), `Escala cambiada a ${TIPO_VENTA[v as TipoVenta]}`)}
                opciones={activas.map((t) => ({
                  valor: t,
                  etiqueta: TIPO_VENTA[t],
                  descripcion: `Desde ${minimos[t]} unidad(es)`,
                }))}
              />
            ) : (
              <p className="text-sm font-medium" data-testid="escala-unica">
                {TIPO_VENTA[tipo]}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unidades</CardTitle>
            <CardDescription>Busca por VIN, o por modelo y color (p. ej. «XSDU-29 gris»).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                buscar();
              }}
            >
              <Input
                aria-label="Buscar unidad"
                placeholder="VIN, modelo o color"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {/* D41: solo el origen (nunca el proveedor) */}
              <Select value={origen} onValueChange={(v) => setOrigen(v as TipoLote | 'todos')}>
                <SelectTrigger className="w-40 shrink-0" aria-label="Origen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo origen</SelectItem>
                  {opciones(TIPO_LOTE).map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" disabled={pendiente}>
                <Search className="size-4" aria-hidden /> Buscar
              </Button>
            </form>

            {resultados && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table aria-label="Unidades disponibles">
                  <TableHeader>
                    <TableRow>
                      <TableHead>VIN</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Colores</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados.unidades.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center whitespace-normal text-muted-foreground" data-testid="sin-resultados">
                          {resultados.hayEnTienda ? (
                            'No hay unidades disponibles con esa búsqueda.'
                          ) : (
                            <>
                              No hay motos listas para vender. Las unidades deben pasar por el{' '}
                              <Link href="/taller" className="font-medium text-foreground underline">
                                Taller
                              </Link>{' '}
                              (baterías, inspección y pasar a tienda).
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {resultados.unidades.map((u) => (
                      <TableRow key={u.vehicle_id}>
                        <TableCell className="font-mono">{u.vin_chasis}</TableCell>
                        <TableCell>
                          <IdentidadModelo modelo={u.modelo} className="min-w-52" />
                          {u.tipo_lote === 'compra_local' && (
                            <Badge variant="secondary" className="mt-1">
                              {TIPO_LOTE.compra_local}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.colores}</TableCell>
                        <TableCell>{u.ubicacion}</TableCell>
                        <TableCell className="text-right">{formatPEN(u.precio)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={pendiente || enOrden.has(u.vin_chasis)}
                            aria-label={`Agregar ${u.vin_chasis}`}
                            onClick={() =>
                              accion(() => agregarUnidad(orderId, u.vehicle_id), `${u.vin_chasis} agregada (reservada)`, () =>
                                setResultados((rs) => rs && { ...rs, unidades: rs.unidades.filter((x) => x.vehicle_id !== u.vehicle_id) }),
                              )
                            }
                          >
                            {enOrden.has(u.vin_chasis) ? 'En la orden' : 'Agregar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table aria-label="Unidades de la orden">
                <TableHeader>
                  <TableRow>
                    <TableHead>VIN</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Colores</TableHead>
                    <TableHead className="text-right">Precio de lista</TableHead>
                    <TableHead className="text-right">Precio final</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        La orden aún no tiene unidades.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono">{i.vin}</TableCell>
                      <TableCell>{i.modelo}</TableCell>
                      <TableCell>{i.colores}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatPEN(i.lista)}</TableCell>
                      <TableCell className="text-right" data-testid={`precio-final-${i.vin}`}>
                        <span className="font-medium">{formatPEN(i.precio)}</span>
                        {i.precio < i.lista && (
                          <span className="block max-w-56 text-xs whitespace-normal text-muted-foreground">
                            −{formatPEN(new Decimal(i.lista).minus(i.precio).toFixed(2))} (
                            {formatPorcentaje(fraccionDescuento(i.lista, i.precio))}) · {i.motivo}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <DialogoPrecioFinal
                          orderId={orderId}
                          itemId={i.id}
                          vin={i.vin}
                          lista={i.lista}
                          precio={i.precio}
                          motivo={i.motivo}
                          limite={esAdmin ? { rol: 'admin', costo: i.costo ?? null } : { rol: 'vendedor', descuentoMax }}
                          deshabilitado={pendiente}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${i.vin}`}
                          disabled={pendiente}
                          onClick={() => accion(() => quitarUnidad(orderId, i.id), `${i.vin} quitada (vuelve a tienda)`)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>
                      {items.length} unidad(es) · escala {TIPO_VENTA[tipo]}
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid="total-orden">
                      {formatPEN(total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {faltan && (
              <Alert>
                <AlertDescription data-testid="faltan-escala">{faltan}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
            <CardDescription>Uno o varios: con más de un método la venta queda como pago mixto (RN-15).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form
              className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                accion(() => registrarPago(orderId, pago), 'Pago registrado', () => setPago((p) => ({ ...p, monto: '', referencia: '' })));
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="pago-metodo">Método</Label>
                <Select value={pago.metodo} onValueChange={(v) => setPago((p) => ({ ...p, metodo: v as MetodoPago }))}>
                  <SelectTrigger id="pago-metodo" className="w-full" aria-label="Método de pago">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['efectivo', 'transferencia', 'tarjeta'] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {METODO_PAGO[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pago-monto">Monto (S/)</Label>
                <Input
                  id="pago-monto"
                  inputMode="decimal"
                  value={pago.monto}
                  onChange={(e) => setPago((p) => ({ ...p, monto: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pago-ref">Referencia (n.º de operación)</Label>
                <Input id="pago-ref" value={pago.referencia} onChange={(e) => setPago((p) => ({ ...p, referencia: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!saldoDecimal.gt(0)}
                  onClick={() => setPago((p) => ({ ...p, monto: saldo }))}
                >
                  Saldo
                </Button>
                <Button type="submit" disabled={pendiente || !pago.monto}>
                  Registrar pago
                </Button>
              </div>
            </form>
            {pagos.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table aria-label="Pagos de la orden">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{METODO_PAGO[p.metodo]}</TableCell>
                        <TableCell>{p.referencia ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatPEN(p.monto_pen)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar pago de ${formatPEN(p.monto_pen)}`}
                            disabled={pendiente}
                            onClick={() => accion(() => eliminarPago(orderId, p.id), 'Pago quitado')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen siempre visible: total, pagado y saldo pendiente */}
      <aside className="grid content-start gap-4 lg:sticky lg:top-4">
        <Card>
          <CardHeader>
            <CardTitle>Orden #{numero}</CardTitle>
            <CardDescription>Borrador · las unidades quedan reservadas</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium">{formatPEN(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pagado{metodo ? ` (${METODO_PAGO[metodo]})` : ''}</dt>
                <dd className="font-medium">{formatPEN(pagado)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t pt-2">
                <dt className="font-medium">Saldo pendiente</dt>
                <dd
                  data-testid="saldo-pendiente"
                  className={cn('text-xl font-semibold', saldoDecimal.isZero() ?'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}
                >
                  {formatPEN(saldo)}
                </dd>
              </div>
            </dl>
            {saldoDecimal.gt(0) && pagos.length > 0 && (
              <BotonCuadrarConPagado
                orderId={orderId}
                items={items}
                pagado={pagado}
                rol={esAdmin ? 'admin' : 'vendedor'}
                descuentoMax={descuentoMax}
              />
            )}
            {motivos.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground" aria-label="Para confirmar">
                {motivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <BotonConfirmar
              etiqueta="Confirmar venta"
              deshabilitado={motivos.length > 0 || pendiente}
              titulo={`¿Confirmar la venta #${numero}?`}
              descripcion={
                <p>
                  Las {items.length} unidad(es) pasan a vendidas y se generan sus garantías. Después solo se podrán cambiar
                  el teléfono y el email; para corregir otra cosa, un admin deberá anularla.
                </p>
              }
              confirmar="Confirmar venta"
              alConfirmar={async () => {
                const ok = avisar(await confirmarOrden(orderId), `Venta #${numero} confirmada`);
                if (ok) router.refresh();
                return ok;
              }}
            />
            <BotonConfirmar
              etiqueta="Eliminar borrador"
              variante="outline"
              titulo={`¿Eliminar el borrador #${numero}?`}
              descripcion="Se borran la orden y sus pagos; las unidades vuelven a tienda (RN-18)."
              confirmar="Eliminar"
              alConfirmar={async () => {
                const ok = avisar(await eliminarOrden(orderId), `Borrador #${numero} eliminado`);
                if (ok) router.push('/ventas');
                return ok;
              }}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
