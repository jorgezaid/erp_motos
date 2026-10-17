'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { DatosModelo } from '@/lib/modelos';
import { normalizarSerial, parsearPegado, textoFaltantes, validarFilas, type FilaRegistro } from '@/lib/registro';
import { avisar } from '@/lib/toast';
import { registrarUnidades } from './acciones';

export type Pendiente = {
  clave: string;
  batch_id: string;
  model_id: string;
  codigo_embarque: string;
  codigo_modelo: string;
  declaradas: number;
  registradas: number;
  modelo: DatosModelo;
};

const SIN_UBICACION = '__ninguna__';

export function RegistroMasivo({
  pendientes,
  ubicaciones,
}: {
  pendientes: Pendiente[];
  ubicaciones: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [ubicacion, setUbicacion] = useState(SIN_UBICACION);
  const [filas, setFilas] = useState<FilaRegistro[]>([]);
  const [pegado, setPegado] = useState('');
  const [escaneo, setEscaneo] = useState({ vin: '', motor: '', color1: '' });
  const [pendiente, startTransition] = useTransition();
  const refVin = useRef<HTMLInputElement>(null);
  const refMotor = useRef<HTMLInputElement>(null);

  const seleccion = pendientes.find((p) => p.clave === clave);
  const faltan = seleccion ? Math.max(seleccion.declaradas - seleccion.registradas, 0) : 0;
  const errores = useMemo(() => validarFilas(filas), [filas]);
  const excede = seleccion !== undefined && filas.length > faltan;

  function agregarPegado() {
    const nuevas = parsearPegado(pegado);
    if (nuevas.length === 0) return;
    setFilas((f) => [...f, ...nuevas]);
    setPegado('');
  }

  function agregarEscaneada() {
    const vin = normalizarSerial(escaneo.vin);
    const motor = normalizarSerial(escaneo.motor);
    if (!vin || !motor) return;
    setFilas((f) => [...f, { vin, motor, color1: escaneo.color1.trim() || null, color2: null }]);
    setEscaneo((e) => ({ vin: '', motor: '', color1: e.color1 }));
    refVin.current?.focus();
  }

  function registrar() {
    if (!seleccion) return;
    startTransition(async () => {
      const r = await registrarUnidades({
        batchId: seleccion.batch_id,
        modelId: seleccion.model_id,
        locationId: ubicacion === SIN_UBICACION ? null : ubicacion,
        filas,
      });
      if (avisar(r, r.ok ? `${r.datos.registradas} unidad(es) registradas` : undefined)) {
        setFilas([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Lote y modelo</CardTitle>
          <CardDescription>Solo se muestran los que aún tienen unidades por registrar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pendiente">Lote y modelo</Label>
            <Select value={clave} onValueChange={setClave}>
              <SelectTrigger id="pendiente" className="w-full" aria-label="Lote y modelo">
                <SelectValue placeholder="Elige el lote y el modelo" />
              </SelectTrigger>
              <SelectContent>
                {pendientes.map((p) => (
                  <SelectItem key={p.clave} value={p.clave}>
                    {p.codigo_embarque} · {p.codigo_modelo} — {textoFaltantes(p.declaradas, p.registradas)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendientes.length === 0 && (
              <p className="text-sm text-muted-foreground">Todos los lotes tienen sus unidades registradas.</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ubicacion">Ubicación inicial (opcional)</Label>
            <Select value={ubicacion} onValueChange={setUbicacion}>
              <SelectTrigger id="ubicacion" className="w-full" aria-label="Ubicación inicial">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_UBICACION}>Sin ubicación</SelectItem>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {seleccion && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-md border p-3 sm:col-span-2">
              <IdentidadModelo modelo={seleccion.modelo} />
              <p className="text-lg font-semibold" data-testid="faltantes">
                {textoFaltantes(seleccion.declaradas, seleccion.registradas)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Unidades</CardTitle>
          <CardDescription>Pega desde Excel o usa el lector de código de barras.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pegar">
            <TabsList>
              <TabsTrigger value="pegar">Pegar desde Excel</TabsTrigger>
              <TabsTrigger value="escanear">Escanear</TabsTrigger>
            </TabsList>
            <TabsContent value="pegar" className="grid gap-2 pt-2">
              <Label htmlFor="pegado">Columnas: VIN, motor, color 1, color 2 (una unidad por fila)</Label>
              <Textarea
                id="pegado"
                rows={6}
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                placeholder={'LXYPCKL01S0000001\tMOT0001\tRojo\tNegro'}
                className="font-mono"
              />
              <div>
                <Button type="button" variant="outline" onClick={agregarPegado} disabled={!pegado.trim()}>
                  Agregar a la lista
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="escanear" className="pt-2">
              {/* El lector funciona como un teclado: Enter = siguiente campo (SPEC §11) */}
              <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor="esc-vin">VIN</Label>
                  <Input
                    id="esc-vin"
                    ref={refVin}
                    value={escaneo.vin}
                    autoComplete="off"
                    onChange={(e) => setEscaneo((s) => ({ ...s, vin: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        refMotor.current?.focus();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="esc-motor">Motor</Label>
                  <Input
                    id="esc-motor"
                    ref={refMotor}
                    value={escaneo.motor}
                    autoComplete="off"
                    onChange={(e) => setEscaneo((s) => ({ ...s, motor: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarEscaneada();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="esc-color">Color</Label>
                  <Input
                    id="esc-color"
                    value={escaneo.color1}
                    onChange={(e) => setEscaneo((s) => ({ ...s, color1: e.target.value }))}
                  />
                </div>
                <Button type="button" variant="outline" onClick={agregarEscaneada}>
                  Agregar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Revisar y registrar</CardTitle>
          <CardDescription>
            {filas.length} unidad(es) en la lista
            {seleccion ? ` · se pueden registrar hasta ${faltan}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(errores.length > 0 || excede) && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {excede && (
                    <li>
                      Hay {filas.length} unidades y el packing list solo admite {faltan} más (RN-04).
                    </li>
                  )}
                  {errores.slice(0, 10).map((e) => (
                    <li key={`${e.linea}-${e.mensaje}`}>
                      Fila {e.linea}: {e.mensaje}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {filas.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Motor</TableHead>
                    <TableHead>Color 1</TableHead>
                    <TableHead>Color 2</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, i) => (
                    <TableRow key={`${i}-${f.vin}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono">{f.vin || '—'}</TableCell>
                      <TableCell className="font-mono">{f.motor || '—'}</TableCell>
                      <TableCell>{f.color1 ?? '—'}</TableCell>
                      <TableCell>{f.color2 ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar fila ${i + 1}`}
                          onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
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
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={registrar}
              disabled={!seleccion || filas.length === 0 || errores.length > 0 || excede || pendiente}
            >
              {pendiente ? 'Registrando…' : `Registrar ${filas.length} unidad(es)`}
            </Button>
            {filas.length > 0 && (
              <Button type="button" variant="outline" onClick={() => setFilas([])}>
                Vaciar lista
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
