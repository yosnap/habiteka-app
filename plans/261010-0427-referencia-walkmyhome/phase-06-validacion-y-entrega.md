---
title: 'Fase 6: Validación y entrega'
status: completed
---

# Fase 6: Validación y entrega

## Objetivo y dependencias

P1. Completada localmente. Validar experiencia completa y ausencia de regresiones. Cada fase anterior ya incluye móvil; esta fase integra y verifica, no inicia su adaptación.

Puerta principal: equivalencia funcional completa. Comparar cada función/opción del inventario, acceso visual nuevo y manejador/servicio original. Las funciones sin equivalente en WalkMyHome se prueban igual que las demás. No se aceptan funcionalidades reducidas, eliminadas o agregadas por imitación.

## Matriz de tareas

| Escenario                 | Evidencia necesaria                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Plano 2D existente        | Comparación visual/gestos/atajos/cotas/original/deshacer contra base; cero rediseño |
| Importación y revisión    | Llegar al editor actual sin perder original, avisos o medidas                       |
| Selección en Amueblado/3D | Propiedades/catálogo/asistente y vuelta con contexto y cámara                       |
| IA contextual             | Alcance y revisión correctos; autorización de gasto y respuesta obsoleta            |
| Diseño/tanda              | Revisión, variante pendiente, aceptación/retirada e incompatibilidad                |
| Vídeo/paseo               | Requisitos, coste, reintento y recuperación; revisión real de tomas/uniones         |
| Planta/exterior/tejado    | Identidad arquitectónica y contexto conservados                                     |
| Red/guardado              | Conflicto, cambios sin sincronizar y reconexión sin duplicar llamadas cobradas      |
| Móvil                     | 360/390 px, teclado virtual, táctil, rotación y áreas seguras                       |
| Accesibilidad             | Tab/Escape/foco, nombres, contraste medido y movimiento reducido                    |

## Pasos

1. Repetir tareas del prototipo en muestra no privada, con datos reales de prueba controlados y permiso antes de cualquier coste.
2. Medir acciones para llegar a las herramientas, retorno y estados entendidos; comparar con línea base. No inventar métricas retrospectivas de WalkMyHome.
3. Verificar escritorio 1440, tableta 768/1024 y móvil 360/390; teclado físico y virtual, táctil y pantalla horizontal.
4. Ejecutar las suites pertinentes de fases 2–5 una vez; ampliar si el diff afecta contratos compartidos o hay fallos.
5. Contrastar manual Starlight, novedades y límites contra implementación. Revisar que cada modalidad anunciada esté realmente disponible.
6. Revisar diff final y archivos menores de 1000 líneas. Entrega local con riesgos reales; commit/push/despliegue solo con autorización del usuario.

## Comandos

```sh
pnpm run typecheck
pnpm exec eslint <archivos-de-codigo-modificados>
npm run docs:updates
npm run docs:build
git diff --check
ak plan validate plans/261010-0427-referencia-walkmyhome
```

La selección de tests detallada vive en cada fase. Para pruebas de servidor con BD, usar el runner aislado del repositorio `pnpm test -- <rutas>` cuando lo exija su configuración; no apuntar a datos de usuario. Si se prepara commit: `npm run docs:updates -- --staged`.

## Archivos y seguimiento

Pruebas existentes citadas en fases; crear regresiones solo para contratos nuevos. Actualizar páginas Starlight afectadas, referencia e informe de validación bajo este plan.

- [x] Verificar tareas integradas y preservación 2D.
- [x] Verificar inventario funcional/opciones completo y mismos servicios, incluidas funciones propias sin equivalente externo.
- [x] Verificar móvil/tableta/escritorio y accesibilidad.
- [x] Verificar coste, permisos, aceptación y recuperación.
- [x] Completar comprobaciones pertinentes y revisión del diff.
- [x] Documentar capacidades entregadas y pendientes.

## Aceptación

Criterios visuales satisfechos y correspondencia funcional completa, sin cambiar motores, servicios o reglas de negocio. Ninguna operación final usa el plano/3D guía como sustituto. Las comprobaciones actuales de hiperrealismo/fidelidad conservan su papel; no generar material para probar un cambio puramente visual salvo autorización específica. La visita continua mantiene su estado pendiente y bloqueo, sin tratar su implementación como objetivo de este rediseño.

## Riesgos y cierre

Regresión del 2D, pérdida de contexto, doble cobro y falsa aceptación son bloqueantes. Una prueba visual privada no se copia al manual. Registrar limitaciones de hardware y capacidades pendientes con motivo, alcance y siguiente paso.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
