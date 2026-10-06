"""Vehículos sin marcas: carrocería suavizada, cristales, ruedas, llantas y luminarias independientes."""
from fam_vehiculos_carroceria import Body, shell, glazing, panel_seams
from fam_vehiculos_detalles import details


def car(piece, spec):
    body = Body(spec)
    shell(piece, body)
    glazing(piece, body)
    panel_seams(piece, body)
    details(piece, body)


BUILDERS = {'car': car}
