# **Documento de Especificación de Requisitos del Proyecto (PRD)**

**Proyecto:** Plataforma de Diseño, Reformas e Interiorismo Inteligente  
**Rol:** Product Manager Senior  
**Estado del Documento:** Versión 1.0 (Especificación Funcional y Conceptual)

## **1\. Visión General del Producto**

El proyecto consiste en una plataforma inteligente e interactiva orientada al sector inmobiliario, reformas, arquitectura e interiorismo. Su propuesta de valor central radica en la capacidad de transformar bocetos, dibujos a mano alzada, planos técnicos o fotografías con anotaciones visuales en documentación técnica y diseños arquitectónicos profesionalizados de nivel ejecutivo. El sistema se apoya en un agente experto interactivo que cualifica la necesidad del usuario mediante un diálogo guiado, adaptando el resultado final a las preferencias estéticas y necesidades técnicas del cliente.

## **2\. Modelos de Negocio y Estrategia de Mercado**

La plataforma se concibe bajo una estrategia híbrida que combina el alcance comunitario con la monetización premium estructurada en dos vertientes principales:

### **2.1. Modelo B2B (Business to Business)**

Destinado a profesionales del sector que integran la herramienta en su flujo comercial diario:

* **Público Objetivo:** Diseñadores de interiores, empresas de reformas, arquitectos, agencias inmobiliarias, tiendas de productos del hogar y administradores de fincas/comunidades de vecinos.  
* **Estrategia de Código Abierto (Open Source Controlado):** El núcleo de la aplicación se distribuye bajo un modelo de código abierto, pero regulado por una licencia de tipo comercial dual o "Fair-code". Esto permite el uso gratuito para fines educativos, de testeo o comunitarios, pero restringe la explotación comercial independiente. Para un uso profesional o comercial, se obliga a los usuarios a hospedar la solución en los servidores oficiales de la plataforma y a consumir los Add-ons y servicios de procesamiento a través de la infraestructura del proveedor original.

### **2.2. Modelo B2C (Business to Consumer)**

Destinado al cliente final o inquilino que desea proyectar cambios en sus propiedades:

* **Acceso Gratuito Limitado:** Uso básico de la interfaz y herramientas que no requieran procesamiento avanzado de agentes de conversión.  
* **Modelo de Suscripción y Créditos (Híbrido):** Para desbloquear la capacidad de subir dibujos, planos o prototipos propios y recibir diseños profesionalizados, el usuario debe adquirir una suscripción periódica (mensual/anual) o paquetes de créditos/tokens por uso. Cada procesamiento avanzado consume una cantidad determinada de créditos en función de la complejidad del entregable solicitado.

## **3\. Características Principales y Flujo de Usuario**

### **3.1. Módulo Core: El Canvas y el Agente Intérprete**

* **Interfaz de Canvas Interactiva:** Un espacio de dibujo integrado en la aplicación donde el usuario puede realizar trazos libres, esquemas rápidos o cargar imágenes previas sobre las cuales dibujar capas de anotaciones a mano.  
* **Entrada Multiformato:** El sistema acepta dibujos manuales realizados directamente en el canvas, planos técnicos digitalizados, renders preliminares o fotografías reales de estancias a reformar (interiores y exteriores).  
* **Agente de Clasificación y Diálogo Técnico:** Una vez recibido el archivo visual, un agente integrado analiza la composición y abre un flujo de conversación interactivo con el usuario. El agente actúa como un arquitecto/diseñador humano realizando preguntas de calificación:  
  * *Identificación del objetivo:* ¿Es un plano de distribución, un diseño de mobiliario o una reforma estructural?  
  * *Definición de estilo estético:* ¿Se busca un enfoque modernista, clásico, retro, industrial, nórdico, etc.?  
  * *Especificaciones técnicas:* Dimensiones aproximadas, materiales preferidos y restricciones espaciales.  
* **Generación de Entregables Profesionales:** Como respuesta al análisis y al diálogo, el sistema genera documentación final de alta fidelidad que incluye planos de arquitectura acotados, prototipos visuales detallados y carpetas de diseño de interiores listas para ejecución.

### **3.2. Módulo de Feedback y Refinamiento Iterativo**

* Una vez entregado el diseño inicial, el usuario dispone de herramientas visuales sobre el resultado para dejar comentarios, seleccionar áreas específicas y solicitar modificaciones puntuales ("cambia esta ventana de posición", "asigna otro color a esta pared"), repitiendo el ciclo de refinamiento hasta la aprobación final.

## **4\. Sistema de Add-ons (Módulos de Valor Añadido)**

Para potenciar la experiencia de usuario y diversificar las vías de ingresos, la plataforma se estructura en un formato modular extensible a través de Add-ons específicos:

| Nombre del Add-on | Descripción Funcional | Impacto en el Modelo de Negocio   |
| :---- | :---- | :---- |
| **Módulo de Votación Comunitaria** | Permite crear salas compartidas donde múltiples usuarios (ej. comunidades de vecinos, familias o socios comerciales) pueden visualizar las propuestas de diseño y emitir votos o comentarios sobre elementos específicos como el tipo de puertas, azulejos, colores de fachadas o el diseño del ascensor. | Atracción masiva y orgánica de usuarios B2C a través de administradores de fincas (B2B). Canal de viralización nativo. |
| **Integración Marketplace y Fabricantes (Ikea, Amazon, etc.)** | Permite al usuario arrastrar, soltar y ubicar de forma precisa productos reales extraídos de catálogos de grandes fabricantes dentro de sus diseños en el canvas o en los entregables finales. Incluye muebles, pinturas, ventanas, puertas y acabados. | Monetización por canales de afiliación y comisiones por venta directa (Revenue Sharing con comercios asociados). Este módulo es gratuito para el usuario final en su uso básico pero requiere suscripción profesional para integraciones avanzadas de catálogos locales. |

## **5\. Requisitos No Funcionales y Reglas de Control de Diseño**

* **Consistencia del Flujo Guiado:** El agente interactivo nunca debe entregar un resultado final sin haber validado previamente mediante el canal de conversación las preferencias de estilo y el tipo de documentación requerido por el usuario.  
* **Escalabilidad Modular:** La arquitectura conceptual del software debe permitir que terceras empresas desarrollen y acoplen nuevos Add-ons de catálogos o herramientas de votación bajo las directrices y SDK de la plataforma central.  
* **Cumplimiento de Licencia:** Todo despliegue externo que intente saltarse el ecosistema de servidores de la plataforma debe quedar inhabilitado para consumir las APIs del agente de interpretación visual.