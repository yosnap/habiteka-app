# Diagnóstico de «Recorrido Paulo» en FInca

**Fuente:** borrador conservado en la pestaña del editor del proyecto `cmu7nm84n0001evmsi8nyt1ee`, planta baja, 26/09/2026. Tiene 44 puntos y 11 tramos bloqueados. El guardado está pausado por conflicto con la revisión 88 de otra pestaña; no se eligió ninguna de las dos versiones.

El informe usa la misma comprobación geométrica que la visita: muestra **el primer bloqueo de cada tramo recto** después de intentar la curva suavizada. Al corregirlo puede aparecer otro bloqueo más adelante en el mismo tramo. Las coordenadas son del plano, en metros.

| Tramo (puntos) | Primer bloqueo (X, Y) | Motivo concreto |
| --- | --- | --- |
| 1 (1→2) | 14,01; 12,09 | Exterior sin suelo transitable definido. |
| 3 (3→4) | 13,65; 16,85 | Exterior sin suelo transitable definido. |
| 9 (9→10) | 5,75; 11,59 | Cruza el muro 24 fuera de una abertura. |
| 17 (17→18) | 4,97; 6,71 | Entra en la cama individual 4, contando 15 cm de margen de cámara. |
| 18 (18→19) | 4,87; 6,48 | Entra en la cama individual 3, contando 15 cm de margen. |
| 19 (19→20) | 4,95; 3,50 | Entra en la cama individual 1, contando 15 cm de margen. |
| 26 (26→27) | 7,96; 7,55 | Cruza el muro 26 fuera de una abertura. |
| 28 (28→29) | 8,79; 8,25 | Entra en la silla Sheen 1, contando 15 cm de margen. |
| 31 (31→32) | 5,37; 9,81 | Cruza el muro 13 fuera de una abertura. |
| 41 (41→42) | 13,19; 16,50 | Toca la columna 10, contando 15 cm de margen. |
| 43 (43→44) | 14,90; 14,11 | Exterior sin suelo transitable definido. |

## Cómo despejar esta ruta

1. **Exterior (1, 3, 43):** ampliar o dibujar un patio con suelo que cubra esos pasos, o mover los puntos al interior del contorno transitable. El vacío exterior se ve despejado, pero la visita no tiene suelo por el que caminar.
2. **Muros (9, 26, 31):** desplazar los tramos hasta las puertas existentes o rodear cada muro. La ruta une los puntos en línea recta; no busca puertas por sí sola.
3. **Muebles y columna (17–19, 28, 41):** desplazar puntos y, si hace falta, añadir otros intermedios para rodear las huellas con los 15 cm de margen del simulador. El panel nuevo permite «Localizar en el plano» cada primera colisión.

El panel del editor ahora muestra este diagnóstico por tramo. La ruta no se editó ni se alteraron las dos versiones en conflicto.

## Corrección y comprobación del 27/09/2026

La revisión guardada 89 ya tenía el descansillo ampliado. Su huella física llegaba de X 13,530 m a X 15,315 m y la terraza alcanzaba X 13,532 m, ambas a cota +1,00 m. Por tanto, **el tramo 3→4 no tenía un hueco real**: el validador descartaba los 15 cm laterales del descansillo aun donde el patio daba apoyo continuo. Se corrigió la comprobación para admitir el paso cuando hay suelo adyacente a la misma cota; los bordes que siguen sin apoyo continúan bloqueados. El tramo 3→4 ya no aparece bloqueado con esa geometría.

En la revisión guardada 92, tras los cambios de puntos realizados en el editor, «Recorrido Paulo» tiene siete primeros bloqueos: 18→19 (Cama individual 2, X 4,985; Y 4,993), 19→20 (Cama individual 1, X 4,952; Y 3,503), 26→27 (Muro 26), 28→29 (Silla Sheen 1), 31→32 (Muro 13), 41→42 (columna 10) y 43→44 (exterior). El tramo 17→18 ya está despejado. Estas son las coordenadas del primer punto bloqueado que detecta el validador, no el centro del mueble.
