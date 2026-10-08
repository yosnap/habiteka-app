"""Familia «jardin»: vegetación y decoración de exterior. Metros, Z arriba, suelo en Z = 0 y frente hacia -Y.

Visten las piezas de Construir › Exterior y jardín (src/lib/editor-document/garden-models.ts). Constructores:
- fam_jardin_arboles: plátano de sombra, olivo, naranjo, arbusto, seto recortado y formio;
- fam_jardin_macetas: maceta de terracota, jardineras con plantas y bancal de huerto;
- fam_jardin_piedras: roca, grupo de piedras y setas de cerámica.
El follaje (ramilletes de hojas CC0 en tarjetas con recorte alfa) está en fam_jardin_follaje.
"""
import fam_jardin_arboles as arboles
import fam_jardin_macetas as macetas
import fam_jardin_piedras as piedras
import fam_jardin_especies as especies
import fam_jardin_aromaticas as aromaticas

BUILDERS = {
    **arboles.BUILDERS,
    **macetas.BUILDERS,
    **piedras.BUILDERS,
    **especies.BUILDERS,
    **aromaticas.BUILDERS,
}
