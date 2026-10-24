"""Módulos superiores con interiores y estantes; librerías y libros independientes."""
import hk_geo as g


def cabinet(piece, spec):
    w, d, h = [v / 1000 for v in spec['dims']]
    p = spec['params']; z = p.get('elev', 0) / 1000; t = .018
    for x in (-w / 2 + t / 2, w / 2 - t / 2):
        piece.add(g.box(t, d, h, .002, 2, at=(x, 0, z)), 'madera')
    for height in (0, h - t):
        piece.add(g.box(w - 2 * t, d, t, .002, 2, at=(0, 0, z + height)), 'madera')
    piece.add(g.box(w - 2 * t, .008, h - 2 * t, at=(0, d / 2 - .004, z + t)), 'madera')
    rows = p.get('rows', 2); cols = p.get('columns', 1)
    for row in range(1, rows):
        piece.add(g.box(w - 2 * t, d - .022, t, at=(0, 0, z + h * row / rows)), 'madera')
    for col in range(1, cols):
        piece.add(g.box(t, d - .022, h - 2 * t, at=(-w / 2 + w * col / cols, 0, z + t)), 'madera')
    if not p.get('open') and 'doors' in p:
        doors = p['doors']; dw = w / doors
        for i in range(doors):
            x = -w / 2 + dw * (i + .5)
            if p.get('glass'):
                for sx in (-1, 1):
                    piece.add(g.box(.035, t, h - .004, at=(x + sx * (dw / 2 - .02), -d / 2 - t, z + .002)), 'frentes')
                for height in (z + .002, z + h - .037):
                    piece.add(g.box(dw - .07, t, .035, at=(x, -d / 2 - t, height)), 'frentes')
                piece.add(g.box(dw - .07, .005, h - .07, at=(x, -d / 2 - t / 2, z + .035)), 'vidrio')
            else:
                piece.add(g.box(dw - .003, t, h - .004, .003, 3, at=(x, -d / 2 - t, z + .002)), 'frentes')
            piece.add(g.box(.11, .025, .01, .003, 2, at=(x, -d / 2 - .043, z + .07)), 'metal')


def bookcase(piece, spec):
    cabinet(piece, spec)
    if spec['params'].get('open'): return
    w, d, h = [v / 1000 for v in spec['dims']]
    cols = spec['params']['columns']; rows = spec['params']['rows']
    for row in range(rows):
        for col in range(cols):
            x0 = -w / 2 + w * col / cols + .045
            for i in range(max(2, int(w / cols / .08) - 1)):
                bh = min(.28, h / rows - .06) * (1 - (i % 3) * .08)
                x = x0 + i * .055; z = h * row / rows + .023
                piece.add(g.box(.041, d * .63, bh, .002, 2, at=(x, -d * .05, z)), 'libro' if i % 2 else 'frentes')
                piece.add(g.box(.035, .004, bh - .02, at=(x, d * .27, z + .01)), 'papel')


BUILDERS = {'wall_cabinet': cabinet, 'bookcase': bookcase}
