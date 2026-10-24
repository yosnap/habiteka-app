'use client';
import { useMemo } from 'react';
import Konva from 'konva';
import { Group, Rect, Text } from 'react-konva';
import type { ComponentProps } from 'react';
import { LABEL_FONTS, type NameLabelStyle } from '@/canvas/editor-v2/workspace-display';

export function PlanNameLabel({ text, viewScale: scale, style, ...props }: ComponentProps<typeof Group> & {
  text: string; viewScale: number; style: NameLabelStyle;
}) {
  const fontFamily = LABEL_FONTS[style.font];
  const measured = useMemo(() => {
    const node = new Konva.Text({ text, fontFamily, fontSize: style.size, fontStyle: style.bold ? 'bold' : 'normal', lineHeight: 1.2 });
    const size = { width: node.width(), height: node.height() }; node.destroy(); return size;
  }, [text, fontFamily, style.size, style.bold]);
  const width = (measured.width + 18) / scale, height = (measured.height + 8) / scale;
  return <Group {...props}>
    {style.backgroundVisible && <Rect x={-width / 2} y={-height / 2} width={width} height={height}
      fill={style.background} cornerRadius={style.radius / scale} />}
    <Text x={-measured.width / scale / 2} y={-measured.height / scale / 2} text={text}
      fontFamily={fontFamily} fontSize={style.size / scale} fontStyle={style.bold ? 'bold' : 'normal'}
      lineHeight={1.2} fill={style.color} />
  </Group>;
}
