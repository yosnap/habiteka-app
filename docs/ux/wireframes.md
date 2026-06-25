# Wireframes — Habiteka

> Wireframes conceptuales (ASCII) para que FE implemente sin ambigüedad. Layout
> desktop-first; en tablet, los paneles laterales colapsan a `Sheet`.

## Layout general (3 zonas)

```
┌──────────────────────────────────────────────────────────────┐
│ Habiteka · ◉─◯─◯─◯─◯ (stepper)        · 120 créditos · 👤     │
├───────────────┬──────────────────────────────┬───────────────┤
│ Cuéntanos     │                              │ Tus diseños   │
│ (chat)        │        CANVAS (Konva)        │ + Comparte    │
│ [colapsable]  │   imagen origen + capas      │ [colapsable]  │
│               │                              │               │
├───────────────┴──────────────────────────────┴───────────────┤
│ ⚖ Estos diseños son una guía conceptual… (barra fija)        │
└──────────────────────────────────────────────────────────────┘
```

## 1. Sube tu espacio (ingesta)

```
┌──────────────────────────────────────────┐
│            Sube tu espacio                │
│   ┌────────────────────────────────────┐ │
│   │  ⬆  Arrastra una foto o plano      │ │
│   │     o  · dibuja aquí · sube archivo│ │
│   └────────────────────────────────────┘ │
│   Analizando tu espacio…  ▰▰▰▱▱  (skeleton)│
├──────────────────────────────────────────┤
│ ⚖ Guía conceptual — barra inferior fija   │
└──────────────────────────────────────────┘
```

## 2. Cuéntanos qué quieres (chat)

```
│ 🤖 ¿Qué te gustaría conseguir en este espacio?   │
│ 🙂 Modernizar el salón                           │
│ 🤖 ¿Qué estilo te atrae?  [Nórdico][Industrial]… │
│ ...                                              │
│ [ Escribe tu respuesta…                    ↑ ]   │
```

## 3. Tus diseños (entrega)

```
┌─ Plano 2D ─┐ ┌─ Render 3D ─┐ ┌─ Memoria ─┐
│ [vista]    │ │ [vista]     │ │ [texto]   │
│ ⚖ sello    │ │ ⚖ sello     │ │ ⚖ sello   │
└────────────┘ └─────────────┘ └───────────┘
[ Generar diseños · GRATIS (1º incluido) ]
```

## 4. Ajusta tu diseño (feedback por zona)

```
   CANVAS con hover-highlight de zonas
   ┌───────────────────────────┐
   │  ▢ salón  ▢ cocina        │  ← al pasar el cursor, la zona se resalta
   │  💡 Haz clic en una pared  │
   │     para modificarla       │
   └───────────────────────────┘
   [ instrucción de cambio… ]  · "1ª iteración gratis"
```

## 5. Comparte y compra (add-ons)

```
┌─ Votación ─────────────┐  ┌─ Marketplace ──────────┐
│ Comparte el enlace 🔗  │  │ [producto] arrastra →  │
│ 👍 12  💬 3 sobre puerta│  │  al diseño             │
└────────────────────────┘  └────────────────────────┘
```
