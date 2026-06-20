# Licencia y uso de Habiteka (fair-code)

> Habiteka se publica bajo la **Sustainable Use License** (ver [`LICENSE`](../LICENSE)).
> Es **fair-code**, no software open source aprobado por la OSI: el uso interno y
> personal es libre; la explotación comercial requiere un acuerdo con Habiteka.

## En una frase

Puedes ver el código, ejecutarlo para ti o para tu empresa internamente, y
modificarlo. **No** puedes ofrecer Habiteka como servicio a terceros ni explotarlo
comercialmente sin una licencia comercial.

## Qué está permitido (sin coste)

- Uso **interno** de tu empresa (operar Habiteka para tus propios fines).
- Uso **personal** o no comercial.
- **Modificar** el software para esos usos.
- **Distribuirlo** gratis y con fines no comerciales, conservando los avisos de
  licencia y copyright.

## Qué NO está permitido sin licencia comercial

- **Hospedarlo como servicio para terceros** (SaaS para otros).
- Proporcionar la funcionalidad de Habiteka a terceros **de forma comercial**.
- Cualquier **explotación comercial** del software hacia terceros.

Para estos casos, necesitas una **licencia comercial**. Escríbenos para obtenerla.

## Cómo funciona el control (legal + operativo, no anti-fork)

El control de la explotación comercial es **legal y operativo**, no una barrera
técnica infranqueable:

1. **Legal**: la Sustainable Use License restringe el uso comercial hacia terceros.
2. **Operativo**: el servicio oficial de Habiteka posee las claves de los
   proveedores de IA y la infraestructura; usar el agente a escala pasa por esa
   infraestructura, que la mayoría no querrá replicar.

Dentro del servicio oficial, cada llamada a IA exige un **token de licencia
firmado** que codifica el plan y el ámbito de uso. Este token sirve para la
experiencia de usuario, la facturación y el ámbito —**no** es una protección
anti-fork—: un fork que aporte su propia clave de proveedor podría ejecutar el
agente, pero ese uso comercial quedaría cubierto (y restringido) por la licencia,
no por el código. Decirlo de otro modo sería engañarse: el código es legible y
forkeable; la barrera real es la licencia más la infraestructura oficial.

## Preguntas frecuentes

**¿Puedo usar Habiteka en mi estudio de interiorismo para mis propios proyectos?**
Sí, es uso interno y está permitido.

**¿Puedo montar una web que ofrezca "diseños con Habiteka" a clientes y cobrar?**
Eso es uso comercial hacia terceros: necesitas una licencia comercial.

**¿Es esto open source?**
No en el sentido OSI. Es **fair-code**: fuente disponible, con restricción
comercial. Puedes leer, ejecutar y modificar el código bajo las condiciones de la
licencia.

**¿Cómo consigo una licencia comercial?**
Contacta con Habiteka para acordar los términos.
