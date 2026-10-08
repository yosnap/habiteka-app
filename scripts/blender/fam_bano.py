"""Familia baño: lavabos, muebles de lavabo, inodoros, bidés, duchas, bañeras y complementos.

Los constructores viven en módulos auxiliares (declarados en FAMILY.dependsOn de families/bano.mjs para que la huella
del generador los incluya): fam_bano_formas (lofts de loza), fam_bano_griferia (grifos y metales),
fam_bano_sanitarios, fam_bano_duchas y fam_bano_complementos.
"""
import fam_bano_complementos as complementos
import fam_bano_duchas as duchas
import fam_bano_sanitarios as sanitarios

BUILDERS = {
    'vessel_basin': sanitarios.vessel_basin,
    'wall_basin': sanitarios.wall_basin,
    'vanity': sanitarios.vanity,
    'toilet': sanitarios.toilet,
    'bidet': sanitarios.bidet,
    'shower_tray': duchas.shower_tray,
    'shower': duchas.shower,
    'bath_built_in': duchas.bath_built_in,
    'bath_freestanding': duchas.bath_freestanding,
    'bath_corner': duchas.bath_corner,
    'mirror': complementos.mirror,
    'tall_cabinet': complementos.tall_cabinet,
    'towel_bar': complementos.towel_bar,
    'towel_radiator': complementos.towel_radiator,
    'paper_holder': complementos.paper_holder,
    'glass_shelf': complementos.glass_shelf,
}
