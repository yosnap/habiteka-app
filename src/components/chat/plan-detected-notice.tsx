'use client';

/**
 * Aviso del paso 2 de la ruta de diseño cuando lo subido es un PLANO en planta.
 *
 * Generar un diseño «a partir de una foto» con un plano produce una maqueta
 * isométrica con los muros reinterpretados: el modelo de imagen no sabe deducir
 * una perspectiva fiel de una planta. La salida buena es convertir el plano al
 * editor y generar las vistas desde el 3D. No se bloquea —decide el usuario—
 * pero la opción recomendada es la primera y la otra avisa de lo que saldrá.
 */
import { Button } from '@/components/ui/button';

interface Props {
  pending: boolean;
  /** Lleva el mismo plano a la ruta «convertir un plano al editor». */
  onConvertPlan: () => void;
}

export function PlanDetectedNotice({ pending, onConvertPlan }: Props) {
  return (
    <div className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Has subido un plano, no una foto.</p>
      <p className="mt-1">
        Con un plano en planta, el generador de imágenes no puede darte perspectivas realistas:
        devolvería una maqueta vista desde arriba con los muros reinventados. Para vistas fieles a
        tus muros, conviértelo al editor y genera desde el 3D.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={onConvertPlan}>
          Convertir el plano al editor
        </Button>
      </div>
      <p className="mt-2 text-xs">
        Si aun así prefieres seguir por aquí, confirma lo detectado más abajo: el resultado será una
        imagen de estilo, no una vista fiel de tu vivienda.
      </p>
    </div>
  );
}
