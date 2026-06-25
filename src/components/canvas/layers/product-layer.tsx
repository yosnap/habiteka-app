'use client';

/**
 * Capa de productos del marketplace soltados en el canvas. Cada referencia se
 * dibuja como un marcador arrastrable; la resolución del producto real (imagen,
 * enlace de afiliación) la hace el servidor — aquí solo vive su posición y su id.
 */
import { Layer, Circle, Text, Group } from 'react-konva';
import type { ProductRef } from '@/canvas/types';

export function ProductLayer({ products }: { products: ProductRef[] }) {
  return (
    <Layer>
      {products.map((p) => (
        <Group key={p.id} x={p.x} y={p.y} draggable>
          <Circle radius={14} fill="#c97b4a" />
          <Text text="🛒" fontSize={16} offsetX={8} offsetY={8} />
        </Group>
      ))}
    </Layer>
  );
}
