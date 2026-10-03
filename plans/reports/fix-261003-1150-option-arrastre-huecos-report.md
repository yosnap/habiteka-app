# Option + arrastrar puertas, ventanas y huecos

El usuario concretó que fallaba en aberturas. La implementación anterior cubría paredes y objetos, pero `OpeningLayer` siempre movía el hueco existente.

La intención de duplicar se captura al pulsar el cuerpo de la abertura y al comenzar el arrastre. Se crea un prototipo independiente, se conserva durante el gesto y se usa para vista previa, validación de destino y colocación. Al soltar sobre un muro válido se añade y selecciona la copia. El original no cambia. Una copia solapada se rechaza contra el original porque sus IDs son distintos. Sin Option se conserva el movimiento anterior. Los tiradores laterales mantienen el redimensionado simétrico con Option.

Validación: 14 pruebas correctas, incluidos los tres tipos de hueco en otra posición, original conservado, rechazo de solapes y movimiento normal sin duplicar. TypeScript, ESLint, `docs:updates` y `docs:build` correctos. Guía y novedades actualizadas. CUA sigue bloqueado por fallo de inicio del pipe nativo; no se afirma comprobación visual del gesto. Sin cambios en proyectos del usuario, commit ni despliegue.

Alcance: arrastre de aberturas en Plano 2D. Las paredes conservan la duplicación implementada en la ronda anterior.

Preguntas pendientes: ninguna. Pendiente la comprobación visual cuando se recupere CUA.
