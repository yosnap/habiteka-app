"""Estructuras exteriores con materiales PBR, uniones y geometría redondeada."""
import math
import hk_geo as g
from fam_equipamiento_agua import BUILDERS as WATER
from fam_equipamiento_vehiculos import BUILDERS as VEHICLES


def dims(spec):
    return [v/1000 for v in spec['dims']]


def porch(p, spec):
    """Cuatro columnas con zócalo/capitel y cubierta continua; la base de acceso es editable en el documento."""
    w, d, h = dims(spec)
    for x in [-w*.42, w*.42]:
        for y in [-d*.38, d*.38]:
            p.add(g.box(w*.1, d*.15, h*.045, .008, at=(x,y,0)), 'blanco')
            p.add(g.box(w*.07, d*.105, h*.865, .006, at=(x,y,h*.045)), 'blanco')
            p.add(g.box(w*.1, d*.15, h*.03, .008, at=(x,y,h*.91)), 'blanco')
    p.add(g.box(w,d,h*.06-.016,.006,at=(0,0,h*.94)), 'blanco')
    # Membrana de cubierta, albardilla perimetral y canto inferior con relieve.
    p.add(g.box(w*.98,d*.97,.012,.003,at=(0,0,h-.015)), 'metal')
    for y in [-d*.485,d*.485]:
        p.add(g.box(w,.03,.035,.004,at=(0,y,h-.035)), 'blanco')
    for x in [-w*.495,w*.495]:
        p.add(g.box(.03,d,.035,.004,at=(x,0,h-.035)), 'blanco')


def pergola(p, spec):
    w,d,h = dims(spec)
    slot = 'metal' if spec['params'].get('metal') else 'madera'
    for x in [-w/2+.09,w/2-.09]:
        for y in [-d/2+.09,d/2-.09]:
            p.add(g.box(.14,.14,h-.12,.007,at=(x,y,0)),slot,grain='z')
            p.add(g.box(.19,.19,.012,.01,at=(x,y,0)),'metal')
            for side in [-1,1]:
                p.add(g.lathe([(0,0),(.014,0),(.014,.008),(0,.008)],12,at=(x+side*.065,y,.013)),'inox')
    for y in [-d/2+.08,d/2-.08]: p.add(g.box(w,.16,.2,.008,at=(0,y,h-.23)),slot)
    for x in [-w/2+.08,w/2-.08]: p.add(g.box(.16,d,.2,.008,at=(x,0,h-.23)),slot,grain='y')
    count = max(3,round(w/.18))
    for i in range(count): p.add(g.box(.11,d,.06,.01,at=(-w/2+(i+.5)*w/count,0,h-.06)),slot,grain='y')


def tent(p,spec):
    w,d,h = dims(spec); eave=h*.77
    for x in [-w/2+.025,w/2-.025]:
        for y in [-d/2+.025,d/2-.025]: p.add(g.box(.05,.05,eave,.008,at=(x,y,0)),'blanco')
    # Paños triangulares ligeramente combados, con nervios en las limatesas.
    corners=[(-w/2,-d/2,eave),(w/2,-d/2,eave),(w/2,d/2,eave),(-w/2,d/2,eave)]
    for i in range(4):
        a,b=corners[i],corners[(i+1)%4]
        p.add(g.surface(12,12,lambda u,v,a=a,b=b: ((a[0]*(1-v)+b[0]*v)*(1-u),
            (a[1]*(1-v)+b[1]*v)*(1-u), eave+(h-eave)*u-.025*math.sin(math.pi*v)*(1-u))),'tela')
        p.add(g.tube([a,(0,0,h)],.012,8),'blanco')
    rolled = spec['params'].get('rolled', 'none')
    for side, x in [('left',-w/2),('right',w/2)]:
        if rolled in [side, 'both']:
            p.add(g.tube([(x,-d/2+.05,eave-.06),(x,d/2-.05,eave-.06)],.04,16),'vidrio')
        else:
            p.add(g.box(.004,d-.1,eave-.06,.001,at=(x,0,.03)),'vidrio')
    p.add(g.box(w-.1,.004,eave-.06,.001,at=(0,d/2,.03)),'vidrio')


def awning(p,spec):
    w,d,h=dims(spec)
    p.add(g.box(w,.15,.16,.06,at=(0,d/2-.075,h-.16)),'blanco')
    for x in [-w*.38,w*.38]:
        p.add(g.tube([(x,d/2,h-.1),(x*.7,0,h-.3),(x,-d/2,h-.5)],.025,10),'inox')
    p.add(g.surface(32,18,lambda u,v: ((u-.5)*w,(v-.5)*d,h-.48+.42*v-.02*math.sin(u*math.pi*16))), 'tela')
    p.add(g.box(w,.035,.14,.005,at=(0,-d/2,h-.62)),'tela')


def umbrella(p,spec):
    w,d,h=dims(spec)
    p.add(g.box(.6,.6,.08,.06),'piedra')
    p.add(g.lathe([(0,0),(.025,0),(.025,h),(0,h)],24),'madera')
    for k in range(8):
        az=k*math.tau/8
        p.add(g.surface(10,8,lambda u,v,az=az: (math.cos(az+v*math.tau/8)*u*w/2,
             math.sin(az+v*math.tau/8)*u*d/2,h-.43*u-.06*math.sin(v*math.pi)*u)), 'tela')
        p.add(g.tube([(0,0,h-.015),(math.cos(az)*w/2,math.sin(az)*d/2,h-.43)],.008,6),'inox')


def grill(p,spec):
    w,d,h=dims(spec); masonry=spec['params'].get('masonry')
    body='piedra' if masonry else 'metal'
    p.add(g.box(w*.65,d*.88,h*.58,.018),'piedra' if masonry else 'metal')
    p.add(g.box(w,d,.045,.015,at=(0,0,h*.59)),'piedra' if masonry else 'inox')
    for i in range(23):
        p.add(g.tube([(-w*.28+i*w*.56/22,-d*.35,h*.65),(-w*.28+i*w*.56/22,d*.35,h*.65)],.006,8),'inox')
    if masonry:
        for x in [-w*.34,w*.34]: p.add(g.box(.1,d*.85,h*.23,.012,at=(x,0,h*.65)),body)
        p.add(g.box(w*.76,d*.9,.07,.015,at=(0,0,h*.88)),body)
        p.add(g.box(w*.22,d*.35,h*.075,.018,at=(0,d*.15,h*.925)),body)
    else:
        # Capota redondeada abierta sobre el fondo: la parrilla queda visible.
        p.add(g.box(w*.64,d*.38,h*.22,.08,at=(0,d*.32,h*.73)),'metal')
        for x in [-w*.28,w*.28]:
            p.add(g.tube([(x,d*.35,h*.62),(x,d*.35,h*.77)],.024,12),'inox')
            p.add(g.tube([(x,d*.32,h*.90),(x,d*.04,h*.94)],.012,10),'inox')
        p.add(g.tube([(-w*.22,d*.04,h*.94),(w*.22,d*.04,h*.94)],.016,10),'inox')
        for x in [-.23,0,.23]: p.add(g.sphere(.028,at=(x,-d*.47,h*.57),segments=16),'inox')
        for x in [-w*.25,w*.25]:
            p.add(g.box(w*.28,.015,h*.48,.009,at=(x,-d*.447,.08)),'metal')
            p.add(g.tube([(x,-d*.49,.28),(x,-d*.49,.45)],.012,8),'inox')


def sprinkler(p,spec):
    w,d,h=dims(spec)
    if spec['params'].get('popup'):
        p.add(g.lathe([(0,0),(w*.5,0),(w*.5,h*.3),(w*.27,h*.32),(w*.27,h*.86),(w*.4,h*.9),(w*.4,h),(0,h)],48),'goma')
        p.add(g.box(w*.27,.005,h*.08,.002,at=(0,-w*.395,h*.91)),'inox')
        return
    p.add(g.lathe([(0,0),(w*.45,0),(w*.48,h*.12),(w*.25,h*.2),(w*.2,h*.8),(0,h*.8)],32),'goma')
    p.add(g.lathe([(0,0),(w*.15,0),(w*.15,h*.45),(0,h*.45)],24,at=(0,0,h*.5)),'inox')
    p.add(g.box(w*.75,d*.3,h*.15,.012,at=(0,0,h*.85)),'metal')
    p.add(g.sphere(w*.07,at=(w*.34,0,h*.92),segments=12),'inox')


BUILDERS={**WATER, **VEHICLES, 'porch':porch,'pergola':pergola,'tent':tent,'awning':awning,'umbrella':umbrella,'grill':grill,'sprinkler':sprinkler}
