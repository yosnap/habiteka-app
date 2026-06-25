# Fase 5 — Integración con tiendas externas

**Depende de:** Fase 1 (catálogo extensible)  
**Estado:** FUTURO — infraestructura lista desde Fase 1, implementación cuando el negocio lo requiera  
**Objetivo:** Que los items del catálogo puedan provenir de tiendas reales (IKEA, Wayfair, tiendas locales), con precio actualizado, link de compra y posibilidad de generar carrito de compra.

---

## Modelo de negocio objetivo

1. **Interiorista diseña** el proyecto en Habiteka con muebles reales de tienda
2. **Cliente recibe** el proyecto compartido con links de compra a cada mueble
3. **Habiteka cobra** comisión de afiliado por cada compra referida (o suscripción al interiorista)
4. **Tienda beneficia** de leads cualificados con intención de compra clara

---

## Fuentes de catálogo externas

### IKEA

- API oficial: no existe pública. Opciones:
  - **Web scraping ético** de ikea.es/es/ con Puppeteer (solo para uso interno del interiorista)
  - **Programa de afiliados IKEA** (Awin): feed de productos en CSV/XML actualizado diariamente
  - **Import manual CSV** por parte del interiorista: sube el feed de IKEA y se indexa

- Campos disponibles en feed IKEA: id, nombre, categoría, precio, URL, imagen, dimensiones
- Modelos 3D IKEA: no disponibles en API. Opciones:
  - Usar modelo genérico del catálogo builtin del mismo `kind`
  - Permitir upload de GLB asociado al producto por parte del interiorista
  - Futura: Sketchfab / 3D Warehouse modelos de comunidad

### Wayfair / Amazon / El Corte Inglés / tiendas locales

- Mismo modelo: feed CSV/XML o scraping con permiso
- El interiorista asocia su cuenta de afiliado → las URLs llevan su ref

### Tiendas locales (mueblería pequeña)

- El dueño de la tienda tiene cuenta en Habiteka
- Sube sus productos con foto + precio + dimensiones
- Sus productos aparecen en el catálogo de los interioristas que los siguen
- Modelo SaaS B2B2B: tienda → interiorista → cliente final

---

## Implementación técnica (cuando llegue el momento)

### Importador de feed

```
POST /api/catalog/import
  body: { source: 'ikea_awin', feedUrl: string, affiliateId: string }
  → descarga feed, parsea CSV/XML
  → upsert en catalog_items con source: 'store', store_name: 'IKEA'
  → encola procesamiento de imágenes (resize → R2)
  → devuelve { imported: N, updated: M, failed: K }
```

Cron job diario para mantener precios actualizados.

### Carrito de compra del proyecto

```
GET /api/projects/[id]/cart
  → lista todos los store items del proyecto
  → agrupa por tienda
  → devuelve URLs de carrito (si la tienda tiene API de carrito)
  → o lista de links individuales para añadir manualmente

Respuesta:
{
  total: 3420.50,
  stores: [
    {
      name: 'IKEA',
      items: [{ name, qty, price, url, affiliateUrl }],
      cartUrl: 'https://ikea.es/cart?...'  // si disponible
    }
  ]
}
```

### Componente `<ShoppingCart />`

Panel flotante en la vista del proyecto (interiorista + cliente):
- Lista de muebles por tienda
- Precio total estimado
- Botón "Ir a comprar" por tienda
- Botón "Exportar lista" (CSV para enviar al cliente)

---

## Lo que la Fase 1 deja listo para esto

| Campo Fase 1 | Uso en Fase 5 |
|-------------|--------------|
| `source: 'store'` | Distingue items de tienda de builtin/custom |
| `store_name` | Agrupa el carrito por tienda |
| `store_product_id` | Enlaza con el producto en la API de la tienda |
| `store_price` | Muestra precio + total estimado del proyecto |
| `store_url` | Link de afiliado a la página del producto |
| `<StoreLabel />` | Badge de precio ya presente en las cards del catálogo |

---

## Criterios de aceptación (cuando se implemente)

- [ ] Import de feed CSV IKEA → productos aparecen en catálogo bajo "IKEA"
- [ ] Precios se actualizan diariamente vía cron
- [ ] Link de afiliado se construye correctamente con ref del interiorista
- [ ] Panel de carrito muestra total del proyecto desglosado por tienda
- [ ] "Exportar lista de compra" genera CSV con nombre, precio, URL por item
- [ ] Tienda local puede darse de alta y subir sus productos (panel admin simple)
