"""Felpudos y floreros, más constructores pequeños de cocina y almacenaje."""
import hk_geo as g
from fam_complementos_cocina import BUILDERS as KITCHEN
from fam_complementos_almacenaje import BUILDERS as STORAGE


def mat(piece, spec):
    w, d, h = [v / 1000 for v in spec['dims']]
    piece.add(g.box(w, d, h * .4, .008, 3), 'negro')
    piece.add(g.box(w - .028, d - .028, h * .6, .006, 3, at=(0, 0, h * .4)), 'carcasa')
    if spec['params'].get('rubber'):
        for i in range(1, int(w / .035)):
            piece.add(g.box(.004, d - .045, .003, at=(-w / 2 + i * .035, 0, h)), 'negro')
    else:
        for i in range(1, int(d / .012)):
            piece.add(g.box(w - .04, .002, .002, at=(0, -d / 2 + i * .012, h)), 'carcasa')


def vase(piece, spec):
    w, _, h = [v / 1000 for v in spec['dims']]; r = w / 2; p = spec['params']
    neck = r * (.35 if p.get('narrow') else .6)
    outer = [(r * .7, 0), (r, h * .3), (r * .94, h * .56), (neck, h * .82), (neck, h)]
    if p.get('straight'): outer = [(r, 0), (r, h)]
    profile = outer + [(radius - .006, z) for radius, z in reversed(outer[1:])] + [(r * .6, .012)]
    piece.add(g.lathe(profile, 48), 'carcasa', sharp=0)


BUILDERS = {**KITCHEN, **STORAGE, 'mat': mat, 'vase': vase}
