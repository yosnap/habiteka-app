"""Piezas reales de cubierta para el catálogo: tejas curvas, vidrio, carpintería y conducto con sombrerete.

Usa el mismo estudio y materiales CC0 del generador de Construir. No genera diseños de un inmueble.
"""
import math
import random
import bmesh


def scenes(api):
    box, plain, textured, add = (api[key] for key in ('box', 'plain', 'textured', 'add'))

    def tiles():
        """Dos pendientes con tejas solapadas y cumbrera; la curvatura es geometría, no un dibujo."""
        objects = []
        clay = [plain(f'teja-{i}', color, rough=.8, bump=.1, bump_scale=95)
                for i, color in enumerate(['#a35b3b', '#af6846', '#ba704b', '#a96546'])]
        rng = random.Random(42)
        for side in [-1, 1]:
            base = bmesh.new()
            base.faces.new([base.verts.new((x, y, 1.105 - abs(y) * .48))
                            for x, y in [(-1.6, 0), (1.6, 0), (1.6, side * 1.46), (-1.6, side * 1.46)]])
            objects.append(add(base, clay[0], 'soporte-tejas'))
            for row in range(5):
                for col in range(12):
                    bm = bmesh.new()
                    arcs = []
                    for t in [0, .36]:
                        y = side * (row * .27 + t)
                        arcs.append([bm.verts.new((-1.56 + col * .26 + k * .026, y,
                                                  1.12 - abs(y) * .48 + .055 * math.sin(k * math.pi / 10))) for k in range(11)])
                    for k in range(10):
                        bm.faces.new((arcs[0][k], arcs[0][k + 1], arcs[1][k + 1], arcs[1][k]))
                    objects.append(add(bm, rng.choice(clay), 'teja-curva', smooth=30))
        for i in range(12):
            bm = bmesh.new()
            arcs = [[bm.verts.new((x, .1 * math.cos(k * math.pi / 12), 1.14 + .1 * math.sin(k * math.pi / 12)))
                     for k in range(13)] for x in [-1.56 + i * .26, -1.26 + i * .26]]
            for k in range(12):
                bm.faces.new((arcs[0][k], arcs[1][k], arcs[1][k + 1], arcs[0][k + 1]))
            objects.append(add(bm, clay[0], 'teja-cumbrera', smooth=30))
        return objects

    def roof(m):
        plaster = textured('muro-cubierta', 'plaster', tint='#f7f3ec', rough=(.7, .95))
        objects = [box(3.05, 2.6, .42, (0, 0, 0), plaster, 'paredes'),
                   box(3.2, .12, .15, (0, -1.37, .45), m['roble'], 'alero'),
                   box(3.2, .12, .15, (0, 1.37, .45), m['roble'], 'alero')]
        # Hastiales triangulares completos bajo las tejas.
        for x in [-1.53, 1.53]:
            bm = bmesh.new()
            front = [bm.verts.new((x, y, z)) for y, z in [(-1.3, .42), (1.3, .42), (0, 1.08)]]
            bm.faces.new(front)
            objects.append(add(bm, plaster, 'hastial'))
        return objects + tiles()

    def window(m, framed=True):
        metal = plain('marco-lucernario', '#343d42', rough=.28, metal=.75)
        glass = plain('vidrio-lucernario', '#b5d4d8', rough=.07, glass=True)
        w, d, t = 1.0, 1.4, .065 if framed else .015
        objects = [box(w - 2 * t, d - 2 * t, .02, (0, 0, .05), glass, 'vidrio')]
        for x in [-w / 2 + t / 2, w / 2 - t / 2]:
            objects.append(box(t, d, .09, (x, 0, 0), metal, 'marco-lateral', r=.003))
        for y in [-d / 2 + t / 2, d / 2 - t / 2]:
            objects.append(box(w - t * 2, t, .09, (0, y, 0), metal, 'marco-testero', r=.003))
        if framed:
            handle = plain('tirador-ventana', '#e0e3e4', rough=.2, metal=.8)
            objects.append(box(.24, .025, .025, (0, -.61, .09), handle, 'tirador', r=.005))
        # Presentación inclinada de la pieza para apreciar el marco y el reflejo del vidrio.
        from mathutils import Matrix
        transform = Matrix.Translation((0, 0, .45)) @ Matrix.Rotation(math.radians(28), 4, 'X')
        for obj in objects:
            obj.matrix_world = transform @ obj.matrix_world
        return objects

    def chimney(m):
        brick = textured('ladrillo-conducto', 'brick', tint='#ba866b', sat=.85, rough=(.75, .95), normal=.8)
        dark = plain('metal-sombrerete', '#41494e', rough=.3, metal=.65)
        objects = []
        for x in [-.23, .23]:
            objects.append(box(.12, .58, 1.18, (x, 0, 0), brick, 'conducto-lateral'))
        for y in [-.23, .23]:
            objects.append(box(.34, .12, 1.18, (0, y, 0), brick, 'conducto-frente'))
        for x in [-.22, .22]:
            for y in [-.22, .22]:
                objects.append(box(.035, .035, .2, (x, y, 1.18), dark, 'soporte'))
        objects.append(box(.74, .74, .08, (0, 0, 1.38), dark, 'sombrerete', r=.006))
        return objects

    return {'tejado': (roof, -38, 24), 'cristal-tejado': (lambda m: window(m, False), -32, 32),
            'ventana-tejado': (window, -32, 32), 'chimenea-tejado': (chimney, -38, 23)}
