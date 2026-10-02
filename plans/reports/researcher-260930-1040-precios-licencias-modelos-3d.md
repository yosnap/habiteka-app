# Precios y licencias de modelos 3D para Habiteka (SaaS Three.js, GLB al navegador)

Fecha de consulta: 2026-09-30. Investigación web (WebSearch/WebFetch) del agente researcher, volcada por el planificador.

**Criterio de marcado**
- VERIFICADO: leído en la propia página con WebFetch.
- SUPUESTO: procede de un resumen de búsqueda o de agregadores de terceros (costbench, toolradar), o la página devolvió 403.

## Conclusión previa

El caso de Habiteka es el más restrictivo: el GLB viaja al navegador del usuario final y cualquiera puede extraerlo desde la pestaña de red. Las licencias estándar de marketplace (Sketchfab, TurboSquid, CGTrader, Design Connected, 3D Warehouse) prohíben dejar el fichero «accesible como archivo». Por eso ninguna licencia estándar de pago es segura tal cual. Solo encajan:
- CC0 (y CC-BY con atribución visible).
- Modelos propios o de encargo con cesión de derechos.
- Licencia custom escrita con el vendedor.
- Salida de IA con plan de pago (propiedad del cliente).

## 1. Tabla comparativa

| Fuente | Tipo | Precio aprox. | Licencia (¿GLB accesible al usuario en SaaS?) | Calidad / formato | URL (consulta 30/09/2026) | Estado |
|---|---|---|---|---|---|---|
| Poly Haven | Individual, gratis | 0 (Patreon voluntario) | CC0. Comercial y redistribución OK, sin atribución | PBR realista, 1K-8K. 115 modelos de mobiliario (API). glTF nativo | polyhaven.com/license, api.polyhaven.com | VERIFICADO |
| Quaternius | Packs gratis | 0. Patreon $10/$20/$50 al mes (llaves «source») | CC0 (Ultimate Furniture Pack: «free to use in personal and commercial projects») | Low-poly, sin textura (20 modelos en ese pack). FBX/OBJ/Blend, convertir a GLB | quaternius.com/packs/ultimatefurniture.html | VERIFICADO |
| Kenney Furniture Kit | Pack gratis | 0 (donación voluntaria) | CC0, atribución solo solicitada | Low-poly, 120 objetos. OBJ, convertir | opengameart.org/content/furniture-kit | SUPUESTO (vía OpenGameArt, no kenney.nl) |
| Poly Pizza | Agregador gratis | 0 | Mezcla CC0/CC-BY; comprobar cada modelo | Low-poly, 10.700+ modelos | poly.pizza | VERIFICADO (nº de modelos); licencia por modelo: SUPUESTO |
| Sketchfab descarga gratuita | Individual | 0 | Según modelo: CC0 libre, CC-BY con atribución, NC/ND excluidos | Variable. glTF nativo | sketchfab.com | SUPUESTO |
| Sketchfab Store | Individual | No verificado | **Standard: prohíbe distribuir como fichero autónomo o dejar que terceros lo descarguen/extraigan** | PBR, variable. glTF | sketchfab.com/licenses | VERIFICADO (licencia); precios: no verificado |
| TurboSquid | Individual | Estándar incluida. Small Business +$99, Enterprise +$229, Agency +$429 sobre el precio del modelo. Design Connected ~$16-33 por modelo | Juegos/software permitidos si los ficheros forman parte de una obra mayor y **no en formato abierto que dé acceso al modelo** | PBR realista. Conversión FBX/OBJ a GLB | turbosquid.com/licensing (403) | SUPUESTO |
| CGTrader | Individual / suscripción | No verificado | Royalty Free: si va en software, «tomar medidas razonables» (p. ej. cifrado) para impedir acceso del usuario final | Variable | cgtrader.com/pages/terms-policies | SUPUESTO (texto no leído) |
| Fab / Megascans | Individual gratis o de pago | Precio por activo. Tier Personal (<$100k ingresos/12 meses) o Professional (>$100k) | Standard: uso en cualquier herramienta, no solo Unreal. **EULA sobre redistribución en bruto no leída (403)** | PBR alto. Conversión (FBX/USD/glTF según activo) | dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab | VERIFICADO (tiers); cláusula de redistribución: no verificado |
| KitBash3D | Suscripción o perpetua por tamaño de empresa | Small Business $3.995/año (SUPUESTO). Cargo Basic gratis no comercial | «You can't share, resell, sublicense, or distribute our assets.» Pensado para cine/juegos/visualización | Kits de escenas/ciudades, no mobiliario de interior | kitbash3d.com/pages/licenses | VERIFICADO (texto); precios: SUPUESTO |
| Poliigon | Suscripción | Hobbyist $12, Professional $24, Studio $37 al mes, Unlimited $27 (SUPUESTO) | Individual: no «share, sell, license, redistribute, or repackage». Hobbyist limitado a cartera personal | PBR, incluye cortinas y similares. Plugins DCC | poliigon.com/terms (403) | SUPUESTO |
| Envato Elements / 3DOcean | Suscripción | $33/mes o $16,50/mes anual | Licencia comercial por proyecto registrado. No leído si permite SaaS con ficheros descargables | Variable | help.elements.envato.com (403) | SUPUESTO |
| Superhive (Blender Market) | Individual | No verificado | Por producto: Standard Royalty Free, CC-BY o Editorial. Suelen prohibir redistribuir | Variable. Blend, convertir | support.superhivemarket.com/article/226 | SUPUESTO |
| Evermotion Archinteriors/Archmodels | Packs | Bundle ~199 € (SUPUESTO) | Standard (<1 M ingresos) o Professional. «Cannot share them with other people» | PBR fotorrealista pesado (archviz, UE5) | evermotion.org | SUPUESTO |
| Dimensiva | Suscripción | No verificado | «Comercial sin atribución» según resumen. Condiciones exactas no leídas | Mobiliario V-Ray, .obj/.3ds/.fbx | dimensiva.com | SUPUESTO |
| Design Connected | Individual | ~$16-33 por modelo (visto en TurboSquid, SUPUESTO) | **Incompatible** (ver sección 2) | PBR realista | designconnected.com/page/view/eula | VERIFICADO (EULA) |
| SketchUp 3D Warehouse | Gratis | 0 | Sin uso comercial salvo lo que autorice la General Model License. Zona gris | Bajo, poco fiable | forums.sketchup.com | SUPUESTO |
| 3dassets.dev | — | — | No localizado por el investigador (Habiteka ya tiene 2 modelos CC0 de esta fuente en `manifest.json`) | — | — | No verificado |
| BIMobject | Catálogo de fabricantes | No verificado | EULA no leída. Útil solo con permiso explícito del fabricante | BIM, rara vez GLB | business.bimobject.com/terms-of-service-eula | No verificado |

## 2. Detalle por fuente

**Sketchfab Store.** Standard = «Single-Seat». Cláusula leída (VERIFICADO, sketchfab.com/licenses): no puedes «sell, license, distribute or otherwise make available the Licensed Material as a stand-alone file (or group of files)» ni permitir que terceros lo «download, extract or access». En Habiteka el usuario puede extraer el GLB: **no encaja**. Editorial está aún más limitado: sin uso comercial ni publicitario.

**Design Connected.** Cláusula textual (VERIFICADO, designconnected.com/page/view/eula): prohíbe «Incorporate the Content in any product that results in a redistribution or re-use of the Content or is otherwise made available in such a manner that a person can extract or access or reproduce the Content as an electronic file» y «Use the Content in applications intended for resale». **Incompatible con SaaS.** Mejor contenido de mobiliario de marca, solo válido para renders.

**TurboSquid / CGTrader.** Permiten juegos y software solo si el modelo no queda accesible como archivo abierto. TurboSquid: «giving away the 3D Model file itself is not allowed». CGTrader sugiere cifrar. Un GLB servido a Three.js es extraíble por diseño; cifrar u ofuscar es frágil y deja riesgo legal residual. Los tiers Enhanced de TurboSquid ($99-$429) son protección legal, no cambian el acceso a ficheros (SUPUESTO). Se puede pedir licencia Custom por escrito (`enterprise@turbosquid.com` o mensaje al autor).

**Fab.** Los tiers dependen solo de ingresos (<$100k / >$100k) con los mismos derechos (VERIFICADO). La EULA en `fab.com/eula` devolvió 403: cláusula sobre redistribución en bruto sin verificar. Se asume la norma habitual («incorporated in a project, no raw redistribution»). Igual para Megascans.

**Poly Haven.** CC0 textual (VERIFICADO): «You can use our assets for any purpose, including commercial work. You do not need to give credit or attribution». Redistribución permitida. 115 modelos de mobiliario PBR. Lo más cercano a calidad de pago sin riesgo.

**Quaternius / Kenney.** CC0 real, apto para SaaS. Low-poly sin textura (Quaternius Ultimate Furniture) y 120 objetos de Kenney. Relleno y prototipo; encajan mal visualmente con Poly Haven PBR. Las llaves «source» de Patreon dan fuentes editables; no verificado que cambie la licencia.

**KitBash3D / Poliigon / Envato / Evermotion.** Todos prohíben redistribuir. Orientados a render. KitBash3D no ofrece mobiliario de interior. Poliigon tiene cortinas y similares, pero con «no redistribute». No recomendados.

**Superhive, Dimensiva, 3D Warehouse, BIMobject.** Sin texto legal leído. No aptos hasta tener permiso escrito.

## 3. Generación IA / fotogrametría / encargo

| Servicio | Precio | Licencia de salida | Estado |
|---|---|---|---|
| Meshy | Free (100 créditos/mes), Pro ~$20/mes, Max ~$60 (SUPUESTO). Imagen→3D: 20 créditos (Meshy 6) o 25 (Meshy 7), texturizado +10 (VERIFICADO) | Gratis: CC BY 4.0, exige atribución. De pago: «User owns all generated outputs», uso comercial pleno (VERIFICADO en docs.meshy.ai/en/webapp/pricing) | Créditos y licencia VERIFICADO; precio Pro SUPUESTO |
| Tripo3D | Free 200 créditos/mes (~8 modelos), Pro $19,90/mes, Max $89,90 (SUPUESTO, costbench) | Gratis: público y CC BY 4.0. Comercial solo en planes de pago (SUPUESTO) | SUPUESTO (oficial 403) |
| Rodin / Hyper3D | Creator $24/mes, Business $120/mes (SUPUESTO, costbench) | Comercial en planes de pago (SUPUESTO) | SUPUESTO |
| Sloyd | Free 1 generación/día, licencia personal. Plus $15/mes, Pro $50/mes | Plus/Pro: «you own what you generate», comercial sin royalties (SUPUESTO, blog de Sloyd). Paramétrico con plantillas de mobiliario, exporta GLB | SUPUESTO; API solo plan custom |
| Kaedim | Starter $29/mes por 50 créditos, Pro $99/mes por 200 (SUPUESTO, toolradar) | No verificado | SUPUESTO |
| Luma Genie | No verificado | No verificado | No verificado |
| Polycam | Plus $6,99/mes, Pro $19,99/mes (SUPUESTO, costbench) | Propiedad y uso comercial en plan gratuito: no verificado | SUPUESTO |
| RealityCapture / RealityScan | No verificado | No verificado | No verificado |
| Encargo (Fiverr/Upwork/estudios) | Sin tarifa fija. Referencia de modelo game-ready listo: ~$7 en RenderHub (SUPUESTO) | Con contrato de cesión de derechos, propiedad del cliente | Precio de encargo a medida: no verificado |

Advertencias:
- La IA puede reproducir el aspecto de un mueble con marca: riesgo de diseño registrado, no de copyright del fichero.
- Las cifras de costbench/toolradar cambian a menudo; confirmar en la web oficial antes de contratar.
- Un modelo de IA suele tener topología mediocre y necesita limpieza (polígonos, texturas) antes de Three.js.

## 4. Recomendación

1. **Gratis, CC0, arrancar ya:** Poly Haven (115 modelos de mobiliario PBR) como base visual. Quaternius y Kenney para relleno de formas simples. Sketchfab CC0 filtrado caso a caso, guardando captura de licencia y autor por modelo.
2. **Pago barato (< 200 € total):** ningún pack de marketplace estándar es seguro. Por orden:
   - Meshy Pro o Sloyd Plus, ~15-20 $/mes durante 2-3 meses (~60 $ total) para cortinas, plantas, lámparas, objetos de estantería y ropa de cama con propiedad del cliente. Validar la licencia oficial el día de contratar.
   - Contactar por escrito a 3-5 autores de Sketchfab/CGTrader/TurboSquid y pedir **licencia custom de distribución web** (precio por modelo pactado).
   - Encargo a modelador freelance con cesión de derechos para piezas clave (sanitarios, ropa de cama).
3. **Evitar por licencia incompatible con SaaS:** Design Connected, Sketchfab Store Standard/Editorial, KitBash3D, Poliigon, Envato Elements, Evermotion Standard, 3D Warehouse. Válidos para renders, no para servir GLB al navegador.
4. **Dudosas hasta verificar:** TurboSquid y CGTrader (solo con cifrado o licencia custom), Fab/Megascans (leer EULA completa).

**Riesgo principal.** Una reclamación por distribuir un GLB de marketplace accesible puede costar más que todo el ahorro. Antes de publicar, revisar con un abogado de PI cualquier modelo que no sea CC0 o propio.

## 5. No verificado (abierto)

- EULA completa de Fab (403), licencia de TurboSquid (403), CGTrader Royalty Free (texto no leído), Poliigon terms (403), Envato license terms (403), Evermotion y Dimensiva (solo resúmenes).
- Precios de Sketchfab Store, Dimensiva, Superhive, Evermotion por pack.
- Precios y licencias exactos de Tripo, Rodin, Kaedim, Luma Genie, Polycam y RealityScan.
- Créditos incluidos en Meshy Pro y coste real por modelo.
- Si las «source keys» de Quaternius Patreon alteran la licencia CC0.
- Licencia por modelo en Poly Pizza (CC0 vs CC-BY).
- Existencia y licencia de 3dassets.dev (Habiteka ya usa 2 modelos de ahí registrados como CC0 en `public/models/cc0/manifest.json`; revisar).
- Mercados españoles/europeos de mobiliario con GLB y BIMobject: no localizados.
- Coste de encargo a medida por mueble.
