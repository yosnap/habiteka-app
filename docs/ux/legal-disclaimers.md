# Disclaimers legales — specs de UX

> Son **requisito legal de la plataforma**: no eliminables por el usuario ni por
> la UI. El texto exacto procede de la arquitectura (§4). El **tono genera
> confianza**, no miedo: el B2C no técnico debe entender que es una guía
> conceptual sin sentirse alarmado ni bloqueado.

## 1. Disclaimer de ingesta (barra inferior)

- **Posición:** barra fija al pie del layout, presente desde la fase de ingesta.
- **Persistencia:** **no-dismissible** (sin botón de cierre). Permanece visible
  durante todo el flujo de diseño.
- **Contraste:** texto sobre fondo `surface-muted` con `ink` → AA garantizado.
- **Texto (tono tranquilizador):** *"Los diseños de Habiteka son una guía
  conceptual creada por IA. Antes de reformar, valida la propuesta con un
  profesional técnico cualificado."*
- **Icono:** ⚖ / escudo, no señal de alarma.
- **Verificación:** F12 (a11y/Playwright) comprueba que existe, es visible y no
  tiene control de cierre.

## 2. Sello en el entregable (marca persistente)

- **Posición:** marca inferior sobre cada entregable (plano/render/memoria),
  opacidad media, legible sin tapar el contenido.
- **Persistencia:** **sobrevive al export** (PNG/PDF) — no es solo overlay de
  pantalla. Lo implementa FE en F6/F7; aquí se especifica.
- **Texto:** *"Documento conceptual generado por Habiteka AI · Revisión técnica
  requerida"*.

## Principios de tono

- Transparente y claro, nunca jurídico-alarmista.
- Informa del límite (conceptual) y del siguiente paso (validar con profesional),
  sin bloquear ni asustar.
- Coherente en los 5 pasos: el mismo lenguaje cercano del resto del producto.
