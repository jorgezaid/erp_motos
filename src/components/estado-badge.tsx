import { Badge } from '@/components/ui/badge';
import { ESTADO_LOTE, ESTADO_ORDEN, ESTADO_RECLAMO, ESTADO_UNIDAD } from '@/lib/etiquetas';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type E = Database['public']['Enums'];

const COLORES: Record<string, string> = {
  // lote
  en_transito: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  en_aduanas: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  en_almacen: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
  liquidado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  // unidad
  en_caja: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  en_ensamble: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  listo_en_tienda: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  reservado: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  vendido: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
  // orden
  borrador: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  confirmada: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  anulada: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  // reclamo
  abierto: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  en_revision: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  aprobado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  rechazado: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  cerrado: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
};

function Etiqueta({ valor, texto }: { valor: string; texto: string }) {
  return <Badge className={cn('border-transparent', COLORES[valor])}>{texto}</Badge>;
}

export const EstadoLote = ({ estado }: { estado: E['batch_status'] }) => <Etiqueta valor={estado} texto={ESTADO_LOTE[estado]} />;
export const EstadoUnidad = ({ estado }: { estado: E['vehicle_status'] }) => (
  <Etiqueta valor={estado} texto={ESTADO_UNIDAD[estado]} />
);
export const EstadoOrden = ({ estado }: { estado: E['order_status'] }) => <Etiqueta valor={estado} texto={ESTADO_ORDEN[estado]} />;
export const EstadoReclamo = ({ estado }: { estado: E['claim_status'] }) => (
  <Etiqueta valor={estado} texto={ESTADO_RECLAMO[estado]} />
);
