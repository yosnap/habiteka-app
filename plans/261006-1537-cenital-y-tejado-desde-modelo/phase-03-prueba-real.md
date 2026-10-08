---
phase: 3
title: "Prueba real en local con Test 6"
status: in-progress
priority: P1
effort: "1h"
dependencies: [1, 2]
---

# Fase 3: prueba real en local

## Objetivo

Comprobar en `http://localhost:3040/projects/cmuue9sxw000jwfms2eekyvkz` que la cenital vuelve a generarse con la ruta configurada y respeta el plano, y que el cierre de tejado produce una imagen coherente.

## Pasos

1. Reconstruir sin coste el prompt de la cenital de la revisión 49: menos de 5000 caracteres, con la chimenea, las sillas, los vehículos y los recuentos.
2. Generar la cenital (Libre, Toda la planta) y anotar la ruta que responde, el coste y el veredicto de la auditoría en `ai_request_cost` y en el entregable.
3. Repetir en Controlado con una sola categoría y comprobar que el prompt lo refleja.
4. Para la isométrica hace falta una cenital aceptada, y para el cierre de tejado una isométrica aceptada. **Aceptar requiere la autorización específica de Paulo**: pedirla, o que acepte él.
5. Con la isométrica aceptada, pulsar «Cerrar tejado desde el modelo» y revisar el encaje, la claraboya, la chimenea y que fuera de la cubierta no cambia nada (`roofClosure.protectedPixels`).
6. Anotar los resultados y los costes en el informe de la fase.

## Verificación

- Las capturas de cada resultado y las filas de `ai_request_cost` de la prueba.
- Ningún servidor arrancado ni parado por el agente: el de la app lo gestiona Paulo.
