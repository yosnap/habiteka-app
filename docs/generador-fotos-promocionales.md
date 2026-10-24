# Generador manual de fotografías promocionales

`scripts/tmp-promo-fotos.ts` conserva un generador provisional para cuatro fotografías narrativas de `promo/presentacion-v3/fotos`. No está conectado a la interfaz ni cambia el flujo de usuario.

El script obtiene la credencial cifrada del proveedor KIE desde la base configurada y utiliza `KieImageProvider` con `google/nano-banana`. Requiere las variables locales de conexión y cifrado; no contiene credenciales. Su ejecución manual con `bun run scripts/tmp-promo-fotos.ts` realiza solicitudes de pago y requiere autorización específica previa. Guardar este script en Git no autoriza ejecutarlo.

Las imágenes son material conceptual de una narración publicitaria. No representan el resultado final de un inmueble ni sustituyen sus diseños IA aceptados. El script no acepta diseños, no publica contenido y no genera un vídeo. Permanece provisional: usa una lista fija de escenas y puede sobrescribir sus archivos de salida.

Se verifica mediante TypeScript sin ejecutar llamadas al proveedor durante las comprobaciones.
