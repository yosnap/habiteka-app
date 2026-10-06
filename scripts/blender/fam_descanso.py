"""Literas y conjuntos completos. Metros; frente hacia -Y, como el resto de la fábrica."""
import math

import hk_geo as geo
import hk_parts as parts
import fam_comedor
import fam_exterior


class PlacedPiece:
    """Transforma cada parte antes de añadirla, conservando UV y materiales del constructor original."""

    def __init__(self, piece, position=(0, 0, 0), angle=0):
        self.piece, self.position, self.angle = piece, position, angle

    def add(self, mesh, slot, grain='x', sharp=35):
        geo.transform(mesh, rot=(0, 0, self.angle))
        return self.piece.add(geo.transform(mesh, loc=self.position), slot, grain, sharp)


def bunk(piece, spec):
    """Dos somieres, colchones, ropa de cama, barandillas superiores y escalera lateral."""
    w, d, h = [value / 1000 for value in spec['dims']]
    lower = spec['params'].get('lowerWidth', 900) / 1000
    upper = .9
    back = d / 2 - .06
    center_y = back - .95
    # El hueco a la derecha de la cama superior contiene la escalera; la doble inferior sobresale a la izquierda.
    upper_x = w / 2 - .2 - upper / 2
    lower_x = w / 2 - .2 - lower / 2
    upper_base = h - .5
    for sx in (-1, 1):
        for sy in (-1, 1):
            piece.add(geo.box(.055, .055, h, .005, 2,
                              at=(upper_x + sx * .48, center_y + sy * .9775, 0)), 'madera', 'z')
    for width, x, base in ((lower, lower_x, .3), (upper, upper_x, upper_base)):
        piece.add(geo.box(width + .07, 1.97, .08, .004, 2, at=(x, center_y, base - .08)), 'madera', 'y')
        if width > upper:
            for sy in (-1, 1):
                piece.add(geo.box(.055, .055, base, .004, 2,
                                  at=(x - width / 2, center_y + sy * .94, 0)), 'madera', 'z')
        piece.add(geo.soft_box(width, 1.9, .16, (.025, .025, .03), (.002, .002, .004),
                              at=(x, center_y, base), density=.1), 'sabanas', 'y', 0)
        piece.add(geo.soft_box(width - .02, 1.35, .045, (.02, .025, .018), (.002, .003, .005),
                              at=(x, center_y - .25, base + .16), density=.1), 'edredon', 'y', 0)
        pillow = parts.pillow(min(width - .12, .65), .4, .1, seed=12)
        piece.add(geo.transform(pillow, loc=(x, center_y + .65, base + .21)), 'sabanas', 'x', 0)
    # Laterales a ambos lados y cierres de cabecera/pies; la escalera desemboca en el tramo abierto lateral.
    for z in (h - .2, h - .06):
        piece.add(geo.box(.035, 1.9, .045, .004, 2,
                          at=(upper_x - .475, center_y, z)), 'madera', 'y')
        piece.add(geo.box(.035, 1.35, .045, .004, 2,
                          at=(upper_x + .475, center_y + .275, z)), 'madera', 'y')
        for sy in (-1, 1):
            piece.add(geo.box(.9, .035, .045, .004, 2,
                              at=(upper_x, center_y + sy * .95, z)), 'madera', 'x')
    x = upper_x + .55
    y = center_y - .7
    for side in (-1, 1):
        piece.add(geo.box(.04, .04, upper_base + .25, .004, 2,
                          at=(x, y + side * .22, 0)), 'madera', 'z')
    for step in range(1, 6):
        piece.add(geo.box(.055, .44, .04, .004, 2,
                          at=(x, y, step * upper_base / 6)), 'madera', 'y')


def dining_set(piece, spec):
    """Mesa y sillas orientadas hacia su centro, con una única huella para mover el conjunto."""
    params = spec['params']
    tw, td = params['table']
    table_spec = {'dims': [tw, td, 750], 'params': {'base': 'tulipa' if params.get('round') else 'conicas'}}
    if params.get('round'):
        fam_comedor.round_table(piece, table_spec)
        radius = tw / 2000 + .24
        positions = [(radius * math.cos(a), radius * math.sin(a), a - math.pi / 2)
                     for a in [k * math.pi / 2 for k in range(4)]]
    else:
        count = params['seats'] // 2
        positions = [(tw / 1000 * ((i + .5) / count - .5), sy * (td / 2000 + .24), 0 if sy == 1 else math.pi)
                     for sy in (-1, 1) for i in range(count)]
        fam_comedor.table(piece, table_spec)
    for x, y, angle in positions:
        fam_comedor.chair(PlacedPiece(piece, (x, y, 0), angle),
                          {'dims': [450, 500, 850], 'params': {'style': 'nordica'}})


def low_seat(piece, spec):
    w, d, h = [value / 1000 for value in spec['dims']]
    parts.emit(piece, fam_exterior.rattan_run(w, d, h, seats=spec['params']['seats'], low=True))


BUILDERS = {'bunk': bunk, 'dining_set': dining_set, 'low_seat': low_seat}
