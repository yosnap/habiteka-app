"""Siluetas propias de hojas (dibujadas por código) y ejemplares de los atlas CC0 que se usan como fuente de color.

Cada silueta es una función shape(s, t, ancho_px, alto_px) → (alfa, envolvente, altura, nervios) sobre la celda de la
hoja: s transversal (0,5 = nervio), t de la base a la punta. Las distancias se miden en unidades del largo de la hoja
(t) y el ancho físico de la celda es `aspect` veces el largo, así que las celdas del atlas deben tener esa proporción.
- alfa: recorte antialiasado (silueta, senos, cortes, perforaciones);
- envolvente: anchura completa de la lámina sin cortes (fracción del ancho de la celda) para deformar la hoja CC0;
- altura: relieve de los nervios (píxeles) para el mapa de normales; nervios: 0..1 para aclarar su color.

Ejemplares CC0 (coordenadas 0..1 de su imagen, base = unión del pecíolo, tip = punta):
- «oscura»: hojas verde oscuro de Poly Haven anthurium_botany_01 (color para monstera, ficus, strelitzia…);
- «clara»: LeafSet018 de ambientCG (verde claro, bambú y olivo);
- «potus»: LeafSet004 de ambientCG (acorazonadas con pecíolo; se usan con su silueta natural);
- «fronda»: frondas de fern_02 de Poly Haven (helecho, silueta natural).
"""
import math

import numpy as np

SPECIMENS = {
    'oscura': [
        {'base': (.588, .556), 'tip': (.018, .632)},
        {'base': (.525, .165), 'tip': (.986, .160)},
        {'base': (.905, .875), 'tip': (.845, .418)},
        {'base': (.070, .085), 'tip': (.451, .165)},
        {'base': (.258, .350), 'tip': (.640, .430)},
    ],
    'clara': [
        {'base': (.156, .930), 'tip': (.152, .030)},
        {'base': (.486, .905), 'tip': (.481, .062)},
        {'base': (.864, .900), 'tip': (.777, .012)},
    ],
    # Silueta natural: base = parte baja de los lóbulos, half = semiancho del marco / largo, attach = t del pecíolo.
    'potus': [
        {'base': (.229, .372), 'tip': (.211, .040), 'half': .37, 'attach': .09},
        {'base': (.497, .383), 'tip': (.495, .042), 'half': .38, 'attach': .09},
        {'base': (.241, .850), 'tip': (.219, .528), 'half': .38, 'attach': .09},
        {'base': (.519, .875), 'tip': (.510, .539), 'half': .34, 'attach': .09},
        {'base': (.786, .836), 'tip': (.791, .547), 'half': .42, 'attach': .09},
    ],
    'fronda': [
        {'base': (.411, .765), 'tip': (.369, .022), 'half': .10},
        {'base': (.167, .950), 'tip': (.176, .109), 'half': .085},
        {'base': (.797, .897), 'tip': (.780, .107), 'half': .085},
        {'base': (.607, .500), 'tip': (.606, .025), 'half': .15},
        {'base': (.576, .966), 'tip': (.575, .508), 'half': .13},
    ],
}


def specimen(name, index, **extra):
    """Ejemplar `index` (cíclico) de un atlas CC0, con opciones extra (side, tissue, detail…)."""
    options = SPECIMENS[name]
    return {**options[index % len(options)], **extra}


def spline(ts, es):
    """Interpolación cúbica monótona (tipo PCHIP) de un perfil de anchura."""
    ts, es = np.asarray(ts, float), np.asarray(es, float)
    d = np.diff(es) / np.diff(ts)
    m = np.zeros_like(es)
    with np.errstate(divide='ignore', invalid='ignore'):
        harmonic = np.where(d[:-1] * d[1:] > 0, 2 / (1 / d[:-1] + 1 / d[1:]), 0)
    m[1:-1] = np.nan_to_num(harmonic)
    m[0], m[-1] = d[0], d[-1]

    def f(t):
        t = np.clip(t, ts[0], ts[-1])
        k = np.clip(np.searchsorted(ts, t) - 1, 0, len(ts) - 2)
        h = ts[k + 1] - ts[k]
        u = (t - ts[k]) / h
        return ((2 * u ** 3 - 3 * u ** 2 + 1) * es[k] + (u ** 3 - 2 * u ** 2 + u) * h * m[k]
                + (-2 * u ** 3 + 3 * u ** 2) * es[k + 1] + (u ** 3 - u ** 2) * h * m[k + 1])
    return f


def _inside(dist_px):
    return np.clip(dist_px + .5, 0, 1)


def _outline(s, t, wpx, env, attach=0.0, notch=0.0):
    e = env(t)
    alpha = _inside((e * .5 - np.abs(s - .5)) * wpx)
    if notch and attach:
        width = notch * np.sqrt(np.clip(1 - t / attach, 0, 1))
        alpha = alpha * np.where(t < attach, _inside((np.abs(s - .5) - width) * wpx), 1)
    return alpha, e


def _ridge(distance, width):
    return np.exp(-(distance / width) ** 2)


def monstera(seed, aspect=.92, splits=7, holes=.7, attach=.16, entire=False):
    """Monstera deliciosa: lámina acorazonada con seno basal, cortes pinnados desde el margen y perforaciones."""
    rng = np.random.default_rng(seed)
    sides = []
    for _side in (-1, 1):
        gaps = rng.uniform(.6, 1.4, splits)
        tk = .24 + .64 * (np.cumsum(gaps) - gaps[0]) / (gaps.sum() - gaps[0])
        beta = np.radians(np.linspace(64, 44, splits) + rng.normal(0, 4, splits))
        inner = rng.uniform(.2, .55, splits)
        hole = rng.random(splits) < holes
        sides.append((tk, beta, inner, hole, rng.uniform(.4, .65, splits), rng.uniform(.8, 1.25, splits)))

    def env(t):
        tc = .40
        lower = np.sqrt(np.clip(1 - ((tc - t) / tc) ** 2.4, 0, 1))
        upper = np.clip(1 - ((t - tc) / (1 - tc)) ** 2, 0, 1) ** .62 * (1 - .12 * np.clip((t - tc) / (1 - tc), 0, 1))
        return np.where(t < tc, lower, upper)

    def shape(s, t, wpx, hpx):
        alpha, e = _outline(s, t, wpx, env, attach, .075)
        x = s - .5
        ax = np.abs(x) * aspect
        edge = e * .5 * aspect
        midrib = _ridge(ax, .007) * (t > attach * .6)
        laterals = np.zeros_like(s)
        for index, side in enumerate((-1, 1)):
            on = (x * side) > 0
            tk, beta, inner, hole, hole_at, hole_size = sides[index]
            lines = [tk[k] + ax / np.tan(beta[k]) + .3 * ax ** 2 for k in range(splits)]
            if not entire:
                for k in range(splits):
                    d = (t - lines[k]) * np.sin(beta[k])
                    x_in = inner[k] * edge
                    ramp = np.clip((ax - x_in) / np.maximum(edge - x_in, 1e-4), 0, 1)
                    half = .0022 + .012 * ramp ** 1.3
                    dist = np.where(ax >= x_in, np.abs(d), np.hypot(d, x_in - ax))
                    alpha = np.where(on, alpha * _inside((dist - half) * hpx), alpha)
                for k in range(splits - 1):
                    if not hole[k]:
                        continue
                    b = (beta[k] + beta[k + 1]) / 2
                    t_mid = (tk[k] + tk[k + 1]) / 2
                    reach = float(np.interp(t_mid, [0, .4, 1], [.3, .5, .2])) * aspect * min(inner[k], inner[k + 1])
                    cx = hole_at[k] * reach + .02
                    ct = (tk[k] + tk[k + 1]) / 2 + cx / np.tan(b) + .3 * cx ** 2
                    du, dv = ax - cx, t - ct
                    along = du * np.sin(b) + dv * np.cos(b)
                    across = dv * np.sin(b) - du * np.cos(b)
                    big, small = .045 * hole_size[k], .013 * hole_size[k]
                    r = np.sqrt((along / big) ** 2 + (across / small) ** 2)
                    alpha = np.where(on, alpha * _inside((r - 1) * small * hpx), alpha)
            for k in range(splits - 1):
                mid = (lines[k] + lines[k + 1]) / 2
                d = (t - mid) * np.sin((beta[k] + beta[k + 1]) / 2)
                laterals = np.where(on, np.maximum(laterals, _ridge(d, .0028) * (ax > .012) * (ax < edge * .97)), laterals)
        veins = np.clip(midrib + .6 * laterals, 0, 1)
        return alpha, e, -1.2 * laterals + 1.5 * midrib, veins
    return shape


def ficus_lyrata(seed, aspect=.75):
    """Ficus lyrata: hoja de violín (ancha arriba, cintura baja), margen ondulado y nervios claros marcados."""
    rng = np.random.default_rng(seed)
    # Base estrecha y acorazonada, cintura y ápice ancho redondeado (arco de círculo desde t = 0,62).
    arc = [(.62 + .38 * math.sin(math.radians(a)), .9 * math.cos(math.radians(a))) for a in (0, 15, 30, 45, 60, 75, 90)]
    base_env = spline([0, .03, .10, .22, .36, .5] + [a for a, _ in arc], [.14, .34, .44, .48, .56, .76] + [b for _, b in arc])
    p1, p2 = rng.uniform(0, 6.28, 2)
    tk = np.linspace(.07, .80, 8) + rng.normal(0, .012, 8)
    beta = np.radians(np.linspace(60, 50, 8))

    def env(t):
        return base_env(t) * (1 + .035 * np.sin(2 * np.pi * 5.2 * t + p1) + .018 * np.sin(2 * np.pi * 11 * t + p2))

    def shape(s, t, wpx, hpx):
        alpha, e = _outline(s, t, wpx, env, .03, .03)
        ax = np.abs(s - .5) * aspect
        edge = np.maximum(e * .5 * aspect, 1e-4)
        midrib = _ridge(ax, .009 * (1.2 - .7 * t)) * (t < .97)
        laterals = np.zeros_like(s)
        for k in range(8):
            line = tk[k] + ax / np.tan(beta[k]) + 1.1 * ax ** 2
            d = (t - line) * np.sin(beta[k])
            fade = 1 - np.clip((ax / edge - .72) / .22, 0, 1)
            laterals = np.maximum(laterals, _ridge(d, .0045 * (1 - .5 * ax / edge)) * fade * (ax > .006))
        veins = np.clip(midrib + .75 * laterals, 0, 1)
        return alpha, e, -1.0 * laterals - .6 * midrib, veins
    return shape


def strelitzia(seed, aspect=.36):
    """Strelitzia nicolai: hoja oblonga en pala con nervio central ancho, nervios paralelos y desgarros al viento."""
    rng = np.random.default_rng(seed)
    env = spline([0, .03, .10, .25, .5, .72, .86, .95, 1], [.32, .62, .86, .98, 1, .93, .74, .42, 0])
    tears = [(rng.choice((-1, 1)), rng.uniform(.14, .86), rng.uniform(.3, 1.0), math.radians(rng.uniform(64, 74)))
             for _ in range(int(rng.integers(2, 6)))]

    def shape(s, t, wpx, hpx):
        alpha, e = _outline(s, t, wpx, env)
        x = s - .5
        ax = np.abs(x) * aspect
        edge = np.maximum(e * .5 * aspect, 1e-4)
        for side, t0, depth, b in tears:
            on = (x * side) > 0
            line = t0 + ax / math.tan(b) + .5 * ax ** 2
            d = (t - line) * math.sin(b)
            x_in = (1 - depth) * edge + .012
            ramp = np.clip((ax - x_in) / np.maximum(edge - x_in, 1e-4), 0, 1)
            half = .0005 + .006 * ramp ** 2
            dist = np.where(ax >= x_in, np.abs(d), np.hypot(d, x_in - ax))
            alpha = np.where(on, alpha * _inside((dist - half) * hpx), alpha)
        phase = (t - ax / math.tan(math.radians(70))) / .0085
        fine = (.5 + .5 * np.cos(2 * np.pi * phase)) ** 6 * (ax > .014)
        midrib = np.clip(1 - (ax - .009) / .006, 0, 1) * (t < .96)
        veins = np.clip(midrib + .18 * fine, 0, 1)
        return alpha, e, 1.6 * midrib + .5 * fine, veins
    return shape


def lanceolate(seed, aspect=.1, widest=.35, power=.8, parallel=True, midrib=1.0, notch_tip=False):
    """Hoja lanceolada (folíolo de kentia, bambú, olivo): base estrecha, punta acuminada y nervios paralelos."""
    rng = np.random.default_rng(seed)
    a = math.log(.5) / math.log(widest)
    skew = rng.uniform(-.05, .05)

    def env(t):
        return np.sin(np.pi * np.clip(t, 0, 1) ** a) ** power

    def shape(s, t, wpx, hpx):
        alpha, e = _outline(s - skew * t * (1 - t), t, wpx, env)
        ax = np.abs(s - .5 - skew * t * (1 - t)) * aspect
        rib = _ridge(ax, .0035 + .002 * (1 - t)) * midrib
        fine = (.5 + .5 * np.cos(2 * np.pi * ax / .0045)) ** 6 * .35 if parallel else 0 * s
        veins = np.clip(rib + fine, 0, 1)
        return alpha, e, 1.2 * rib + .4 * fine, veins
    return shape


def solid(height_fn=None):
    """Celda opaca (hoja carnosa de sansevieria): todo el marco visible, sin envolvente."""
    def shape(s, t, wpx, hpx):
        one = np.ones_like(s)
        return one, one, height_fn(s, t) if height_fn else None, 0 * s
    return shape
