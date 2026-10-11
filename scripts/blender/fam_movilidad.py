"""Más carrocerías y vehículos de dos ruedas; conservan la identidad completa al girar."""
from fam_vehiculos_carroceria import Body, shell, glazing, panel_seams
from fam_vehiculos_detalles import details
from fam_movilidad_dos_ruedas import BUILDERS as TWO_WHEELS


def car(piece, spec):
    body = Body(spec)
    if spec['params'].get('coupe'):
        body.rows = [(-.50,.40,.75),(-.46,.47,.92),(-.29,.51,.96),(-.20,.58,.95),
                     (-.06,.95,.76),(.12,1,.74),(.23,.89,.79),(.36,.59,.94),(.46,.53,.94),(.50,.44,.8)]
    shell(piece, body); glazing(piece, body); panel_seams(piece, body); details(piece, body)


BUILDERS = {**TWO_WHEELS, 'car': car}
