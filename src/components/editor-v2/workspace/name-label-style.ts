import type { CSSProperties } from 'react';
import { LABEL_FONTS, type NameLabelStyle } from '@/canvas/editor-v2/workspace-display';

export function nameLabelCss(style: NameLabelStyle): CSSProperties {
  return { color: style.color, background: style.backgroundVisible ? style.background : 'transparent',
    borderRadius: style.radius, padding: '4px 9px', fontFamily: LABEL_FONTS[style.font],
    fontSize: style.size, fontWeight: style.bold ? 700 : 400, lineHeight: 1.2,
    whiteSpace: 'nowrap', pointerEvents: 'none' };
}
