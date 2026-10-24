'use client';

import { forwardRef, useMemo, type ComponentProps } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

/**
 * `Html` de drei con el contenedor fijado desde el primer render.
 *
 * @react-three/fiber 9.8 monta la escena de forma síncrona y, en esa misma
 * pasada, `Html` cambia de contenedor (del padre del canvas a la fuente de
 * eventos). Ese cambio recrea su raíz de React sobre el mismo elemento antes de
 * que la anterior termine de desmontarse, y en producción puede vaciar una
 * etiqueta y fallar al salir de la escena (pmndrs/drei#2867). Con un `portal`
 * estable el contenedor no cambia.
 */
export const SceneHtml = forwardRef<HTMLDivElement, ComponentProps<typeof Html>>(function SceneHtml({ portal, ...props }, ref) {
  const gl = useThree((state) => state.gl);
  const container = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  return <Html ref={ref} portal={portal ?? container} {...props} />;
});
