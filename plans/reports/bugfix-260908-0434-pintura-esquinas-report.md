# Pintura continua en esquinas

## Causa y solución

Los laterales de `junctionMeshes` usaban material neutro global, dejando cortes en el acabado. `junctionFinishes` asigna cada arista a una cara orientada de pared incidente mediante alineación y distancia. Render de planos laterales con ese acabado; coronación oscura independiente. Click en arista selecciona su pared real.

Sin cambio del documento persistido, geometría, colisiones ni historia. Modificación de escena derivada y renderer únicamente. Original y datos del proyecto preservados.

## Evidencia

- Comet: escena independiente, interior rojo y exterior azul alcanzan extremos, coronación oscura. Órbita y vista completa observadas. Proyecto real dejado en3D sin editar datos.
- Test nuevo verifica dos exteriores distintos en el mismo inglete: cada arista mantiene color correspondiente; otra prueba conserva cara interior y paredes vecinas al cambiar exterior.
- Suite948aprobadas/5omitidas,140archivos/4omitidos,22,83s; typecheck y lintscope aprobados.
- Buildaislado Next16webpack aprobado25/25rutas; compile5,8s,TS7,8s. AdvertenciasOAuth por entorno sin credenciales. Servidor3041 no detenido.

## Pendientes

Curvas siguen pendientes. Esta corrección no acredita matriz completa de alturas desiguales, biseles agudos y múltiples paredes por vértice en navegador; no se declara paridad completa con Planner5D.
