# Flujo del Agente Inteligente - Habiteka

## Arquitectura Conceptual del Flujo

El núcleo operativo de Habiteka se basa en un procesamiento iterativo y conversacional dividido en cinco fases consecutivas. Este flujo garantiza que la Inteligencia Artificial actúe bajo las directrices estéticas del usuario y cumpla con las restricciones de transparencia legal de la plataforma.

```
[Fase 1: Ingesta] → [Fase 2: Cualificación] → [Fase 3: Entrega] → [Fase 4: Feedback] → [Fase 5: Add-ons]
```

---

## Fase 1: Ingesta en el Canvas y Análisis de Intención

### Acción del Usuario
El usuario accede a la interfaz de lienzo (Canvas) e introduce un archivo de origen. Este archivo puede ser:
- Un dibujo a mano alzada realizado in-app
- Un plano técnico antiguo digitalizado
- Una fotografía de una propiedad (interior/exterior) con anotaciones visuales superpuestas

### Procesamiento del Agente
El sistema ejecuta un escaneo visual preliminar sin intervención del usuario para identificar elementos estructurales clave:
- Muros
- Ventanas
- Puertas
- Pilares
- Límites del espacio

### Control Legal y UX
En la base de la pantalla de carga, el sistema muestra obligatoriamente el siguiente disclaimer transparente:

> ⚖️ **"El asistente automatizado de Habiteka interpretará los trazos de forma conceptual. Toda propuesta espacial generada requerirá validación por un profesional técnico cualificado del sector."**

---

## Fase 2: Diálogo Conversacional de Cualificación

Antes de procesar o renderizar cualquier resultado, el agente abre una interfaz de chat interactiva para acotar los requisitos técnicos y estéticos:

### Validación Estructural
El agente interroga al usuario sobre las intenciones de la obra.
- **Ejemplo:** "He detectado una distribución de salón-cocina. ¿Se mantendrán los tabiques actuales o se proyecta el derribo de muros?"

### Definición de Línea Estética
El sistema solicita la preferencia de estilo mediante opciones rápidas o texto libre.
- **Ejemplos:** Modernista, Nórdico, Industrial, Clásico, Retro

### Selección de Entregables
El usuario define qué documentación técnica o gráfica necesita como respuesta final.
- **Ejemplos:**
  - Plano arquitectónico acotado 2D
  - Render fotorrealista 3D
  - Memoria de materiales

---

## Fase 3: Generación y Entrega del Borrador Técnico

### Procesamiento Final
El agente unifica el análisis visual de la imagen de origen con los parámetros recopilados en el diálogo conversacional.

### Despliegue en el Canvas
El sistema sustituye o superpone al boceto original el entregable profesionalizado de alta fidelidad.

### Marcado de Seguridad Legal
Todos los entregables gráficos generados de forma automatizada por la plataforma incluirán un sello indeleble en el margen inferior:

> **[ Documento conceptual generado por Habiteka AI - Revisión técnica requerida ]**

---

## Fase 4: Bucle de Feedback y Refinamiento Iterativo

### Interacción de Zona
El usuario puede seleccionar directamente un objeto, pared o área específica del diseño generado dentro del Canvas.

### Modificación Asistida
Al hacer clic en un elemento, el chat del agente se activa contextualmente.
- **Ejemplo:** "Has seleccionado la ventana principal. ¿Deseas modificar sus dimensiones, su ubicación en el muro o el material del marco?"

### Actualización Selectiva
El sistema procesa exclusivamente la modificación indicada por el usuario, manteniendo intacto el resto del diseño e inmueble.

---

## Fase 5: Activación de Módulos de Valor Añadido (Add-ons)

Una vez aprobado el diseño conceptual en el Canvas, el agente habilita las pasarelas hacia los módulos de negocio integrados:

### Habilitación de Votación Comunitaria
Opción de exportar el diseño final a una sala pública para que inquilinos, vecinos o socios comerciales voten sobre los acabados.
- **Ejemplos:** tipo de puertas, ascensores, pinturas

### Conexión con Marketplace de Proveedores
El agente escanea los muebles, acabados y colores del diseño final y ofrece al usuario un desglose de productos reales listos para comprar en tiendas asociadas.
- **Asociados:** Ikea, Amazon, comercios de pintura locales
- **Modelo:** activación del sistema de afiliación de la plataforma

---

## Resumen Visual del Flujo

| Fase | Entrada | Procesamiento | Salida |
|------|---------|---|--------|
| **1. Ingesta** | Imagen/dibujo del usuario | Análisis visual estructural | Elementos identificados + Disclaimer legal |
| **2. Cualificación** | Parámetros del usuario (chat) | Validación estructural, estética, entregables | Requisitos técnicos consolidados |
| **3. Entrega** | Parámetros + análisis visual | Generación de propuesta profesional | Diseño borrador + sello de validación |
| **4. Feedback** | Selección en Canvas + modificaciones | Actualización selectiva iterativa | Diseño refinado |
| **5. Add-ons** | Diseño aprobado | Habilitación de módulos complementarios | Votación comunitaria + Marketplace |

