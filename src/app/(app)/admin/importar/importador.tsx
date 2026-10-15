'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { avisar } from '@/lib/toast';
import { analizarPlantilla, confirmarImportacion, type AnalisisPublico, type ResultadoImportacion } from './acciones';

function formulario(archivo: File) {
  const f = new FormData();
  f.set('archivo', archivo);
  return f;
}

export function Importador() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisPublico | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refArchivo = useRef<HTMLInputElement>(null);

  function elegir(f: File | null) {
    setArchivo(f);
    setAnalisis(null);
    setResultado(null);
  }

  function importar() {
    if (!archivo) return;
    startTransition(async () => {
      const r = await analizarPlantilla(formulario(archivo));
      if (avisar(r)) setAnalisis(r.datos);
    });
  }

  function confirmar() {
    if (!archivo) return;
    startTransition(async () => {
      const r = await confirmarImportacion(formulario(archivo));
      if (avisar(r, 'Importación guardada')) {
        setResultado(r.datos);
        setAnalisis(null);
        setArchivo(null);
        if (refArchivo.current) refArchivo.current.value = '';
      }
    });
  }

  const conErrores = (analisis?.errores.length ?? 0) > 0;

  return (
    <div className="grid max-w-5xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Sube la plantilla llena</CardTitle>
          <CardDescription>
            Usa <span className="font-mono">plantilla-datos-reales-erp-v2.xlsx</span> sin mover hojas ni columnas. Un lote por
            archivo. Se ignoran las hojas Instrucciones y Preguntas negocio, la fila gris de EJEMPLO y las celdas verdes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="archivo">Archivo de la plantilla (.xlsx)</Label>
            <Input
              id="archivo"
              ref={refArchivo}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => elegir(e.target.files?.[0] ?? null)}
              className="max-w-sm"
            />
          </div>
          <Button type="button" onClick={importar} disabled={!archivo || pendiente}>
            {pendiente && !analisis ? 'Revisando…' : 'Importar Excel'}
          </Button>
        </CardContent>
      </Card>

      {analisis && (
        <Card>
          <CardHeader>
            <CardTitle>2. Revisa qué se va a guardar</CardTitle>
            <CardDescription>
              {analisis.nombreArchivo}
              {analisis.codigoLote &&
                ` · Lote ${analisis.codigoLote} (${analisis.loteExiste ? 'ya existe: se actualiza' : 'nuevo'})`}
              . Lo que no está en el archivo no se toca, y una celda vacía conserva el valor que ya había.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {analisis.resumen.length > 0 && (
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hoja</TableHead>
                      <TableHead className="text-right">Se crean</TableHead>
                      <TableHead className="text-right">Ya existen (se actualizan si cambió algo)</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analisis.resumen.map((r) => (
                      <TableRow key={r.hoja} data-testid={`resumen-${r.hoja}`}>
                        <TableCell className="font-medium">{r.hoja}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.crear}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.actualizar}</TableCell>
                        <TableCell className="text-muted-foreground">{r.nota ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {conErrores ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {analisis.errores.length} error(es): corrige el Excel y vuelve a subirlo. No se guardó nada.
                </AlertTitle>
                <AlertDescription>
                  <div className="mt-2 max-h-96 w-full overflow-auto">
                    <Table aria-label="Errores de la plantilla">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hoja</TableHead>
                          <TableHead>Fila</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analisis.errores.map((e, i) => (
                          <TableRow key={`${e.hoja}-${e.fila}-${i}`}>
                            <TableCell>{e.hoja}</TableCell>
                            <TableCell className="tabular-nums">{e.fila ?? '—'}</TableCell>
                            <TableCell className="whitespace-normal">{e.mensaje}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm">Sin errores. Al confirmar se guarda todo o nada; el costeo y la liquidación se hacen después en la pantalla del lote.</p>
            )}

            {analisis.usuarios.length > 0 && (
              <div className="grid gap-2">
                <h3 className="font-medium">Usuarios de la hoja Usuarios (no se crean cuentas)</h3>
                <p className="text-sm text-muted-foreground">
                  Créalos en Supabase → Authentication → Add user, y luego asígnales el rol en Administración → Usuarios.
                </p>
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fila</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analisis.usuarios.map((u) => (
                        <TableRow key={u.fila}>
                          <TableCell className="tabular-nums">{u.fila}</TableCell>
                          <TableCell>{u.nombre || '—'}</TableCell>
                          <TableCell>{u.email || '—'}</TableCell>
                          <TableCell>{u.rolValido ? u.rol : `${u.rol || '—'} (rol no válido: admin, tecnico o vendedor)`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div>
              <Button type="button" onClick={confirmar} disabled={conErrores || pendiente}>
                {pendiente ? 'Guardando…' : 'Confirmar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Importación guardada</CardTitle>
            <CardDescription>
              Lote {resultado.lote.codigo_embarque} {resultado.lote.creado ? 'creado' : resultado.lote.actualizado ? 'actualizado' : 'sin cambios'}.
              Ahora revisa sus pestañas Auditoría y Costeo para guardar el costeo y liquidarlo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="list-disc pl-5 text-sm" data-testid="resultado-importacion">
              <li>Ubicaciones: {resultado.ubicaciones.creadas} creadas, {resultado.ubicaciones.actualizadas} actualizadas</li>
              <li>Modelos: {resultado.modelos.creados} creados, {resultado.modelos.actualizados} actualizados</li>
              <li>Packing list: {resultado.packing.creadas} líneas creadas, {resultado.packing.actualizadas} actualizadas</li>
              <li>Unidades: {resultado.unidades.creadas} creadas (en caja), {resultado.unidades.actualizadas} actualizadas</li>
              <li>Baterías: {resultado.baterias.creadas} registradas</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/lotes/${resultado.lote.id}`}>Ver el lote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/lotes/${resultado.lote.id}/unidades`}>Ver sus unidades</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/inventario">Ir al inventario</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
