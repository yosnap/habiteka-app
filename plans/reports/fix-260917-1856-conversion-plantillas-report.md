# Conversión de plantillas y color de luz aplazado

## Resultado

Issue #42 creada para color RGB emitido, separado del acabado físico y con modo
Kelvin/RGB compatible con documentos previos. Sin implementar por petición expresa.

Corregida conversión de las cinco plantillas builtin: metadata del wizard define
muros verticales sin rotación; el adaptador anterior suponía eje horizontal para
todos. Los ejes se conectan compensando medias esquinas y conservan las caras
interiores. ceilingHeightM pasa a altura de muros en schema3. Snapshot intacto;
metadata desconocida y alturas inválidas siguen bloqueando. Otros tipos legacy con
capas no convertidas (floorOutline, etc.) mantienen su bloqueo explícito.

## Validación

- 25 pruebas de adaptadores, regresiones y plantillas pasan.
- Ampliación: 195 pruebas locales pasan en 34 archivos.
- 4 pruebas de integración editor-legacy-authority fallan antes de ejecutar por
  credenciales ausentes en DATABASE_URL de prueba: SASL password must be a string.
  No se declara validación de integración completa ni se modifica la base real.
- TypeScript, ESLint de los tres archivos tocados y git diff --check correctos.
- Navegador: proyecto propio de prueba cmu5rbo8v000ak2msrpfdhono (Salón comedor)
  muestra habitación cerrada/muebles, permite activar editor y queda Sincronizado.
  Una nueva pestaña confirma persistencia de la activación y editor editable.
- No llamadas IA de pago, commits ni cambios en proyectos del usuario.

Preguntas pendientes: ninguna.
