# Corrección del suelo interior

## Causa y solución

El suelo seguía los ejes de las paredes y extruía una losa de 8 cm bajo nivel cero. La vista interior dejaba expuestos tanto ese canto como medio espesor de pared.

Ahora `floorMeshes` resta las huellas de muros y uniones que alcanzan el suelo mediante `polygon-clipping` 0.15.7. Renderiza una superficie plana con huecos, sin modificar el documento guardado. Conserva los umbrales de puertas a nivel cero. Cuantiza a 0.00001 mm para evitar residuos trigonométricos en las operaciones geométricas.

## Verificación

- Suite completa: 954 pruebas aprobadas, 5 omitidas.
- 17 pruebas focales aprobadas también tras ajustar la importación ESM; incluyen rectángulos, grosores distintos, L giradas, puertas, ventanas, muros aislados y recintos consumidos por el espesor.
- TypeScript y lint del alcance aprobados.
- Comet: inspección de habitación con vista interior y todos los muros; no se observa el canto inferior ni suelo saliendo por fuera. No se alteró el documento del usuario.
- La primera compilación detectó una importación nombrada incompatible con Webpack; corregida a la exportación por defecto.
- Compilación aislada final aprobada: 25/25 páginas, sin advertencia de importación; solo avisos esperados de proveedores OAuth sin credenciales en el entorno de prueba.

## Alcance

Corrección del acabado del suelo, no implementación de forjados estructurales ni paredes curvas. Las curvas siguen pendientes. No se ha hecho despliegue ni commit.
