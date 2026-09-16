# Ampliación aprobada: cotas, acabados, plantas y curvas

Usuario aprueba migración compatible y ejecución continua con pruebas, sin puertas de aprobación intermedias.

## Contrato

Resultado: cotas con flechas durante el trazo; suelos seleccionables con color y textura; gestión de plantas independientes; pared curva canónica editable, consistente en 2D/3D. Preservar documentos históricos, historia, guardado, vanos y comentarios. No cambiar stack ni desplegar.

## Secuencia y revisión

1. Reutilizar DimensionMark para trazos de pared y rectángulo. Cotas efímeras sin contaminar el documento.
2. Incorporar acabados por ID estable de habitación; selección del suelo y controles propios, texturas compartidas entre 2D/3D.
3. Incorporar plantas con identidad y altura; aislar geometría de cada planta, conservar historial y validar persistencia.
4. Incorporar trayectoria curva compartida para mallas, huecos, cotas, área y colisiones. No persistir paredes ficticias como sustituto de una curva.
5. Pruebas unitarias, contratos históricos, Comet, lint, TypeScript y compilación aislada. Registrar limitaciones reales y no afirmar paridad completa.

## Contexto revisado

EditorDocument admite versiones 2/3/4. Validación estricta de claves. Comandos trabajan con una planta; store centraliza transacciones, historial y colocación espacial. deriveRooms produce IDs por conjunto de paredes. La vista 3D se deriva del documento. La referencia muestra selector superior con Planta baja, otras plantas y Nueva planta.

## Criterios observables

- Flechas y medida cambian antes de confirmar el trazo; cancelar no guarda cotas.
- Acabado del suelo persiste al cambiar de vista y reabrir; no pinta paredes.
- Cambiar planta no mezcla paredes ni colisiones entre niveles; deshacer recupera operaciones.
- Curvar y volver a recta conserva identidad y acabados; unión, suelo y aberturas concuerdan en ambas vistas.

## Riesgos

Contratos transversales: no convertir lectura en migración silenciosa. Curvas y niveles requieren pruebas específicas, no solo controles visuales.
