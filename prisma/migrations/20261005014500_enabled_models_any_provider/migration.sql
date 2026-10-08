-- Los modelos habilitados por el administrador pueden ser también de OpenRouter, NaN u OpenAI, que no tienen fila en
-- ai_custom_provider. Al borrar un proveedor propio, sus modelos se borran desde la aplicación.
ALTER TABLE "ai_custom_model" DROP CONSTRAINT "ai_custom_model_providerId_fkey";
