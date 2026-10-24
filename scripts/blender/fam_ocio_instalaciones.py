"""Mobiliario de parque, luminarias colgadas y climatización con cota de montaje real."""
import math
import hk_geo as g


def dims(spec): return [v/1000 for v in spec['dims']]


def park_bench(piece,spec):
    w,d,h=dims(spec)
    for x in (-w*.35,w*.35):
        piece.add(g.tube([(x,-d*.35,0),(x,-d*.35,.43),(x,d*.3,.43),(x,d*.3,h)], .035), 'metal')
        piece.add(g.tube([(x,d*.3,.43),(x,d*.3,0)], .035), 'metal')
    for i in range(4):
        piece.add(g.box(w,d*.17,.035,.007,3,at=(0,-d*.28+i*d*.18,.43)), 'madera')
    for z in (.58,.7,.82):
        piece.add(g.box(w,.035,.09,.007,3,at=(0,d*.31,z)), 'madera')


def bin(piece,spec):
    w,d,h=dims(spec)
    piece.add(g.lathe([(w*.42,0),(w*.48,h*.92),(w*.43,h*.96),(w*.38,.05)], 32), 'metal')
    for k in range(16):
        a=k*math.tau/16
        piece.add(g.box(.025,.025,h*.82,.003,2,at=(w*.44*math.cos(a),d*.44*math.sin(a),h*.05)), 'madera')


def streetlight(piece,spec):
    w,d,h=dims(spec)
    piece.add(g.lathe([(.1,0),(.1,.08),(.035,.13),(.035,h*.89)], 24), 'metal')
    piece.add(g.box(w*.55,d*.55,h*.09,.015,3,at=(0,0,h*.88)), 'blanco')
    piece.add(g.lathe([(.02,0),(w*.5,.01),(0,h*.05)], 32,at=(0,0,h*.98)), 'metal')


def lights(piece,spec):
    w,d,h=dims(spec); elev=spec['params']['elev']/1000
    curve=lambda x: elev+h-.2*(1-(2*x/w)**2)
    piece.add(g.tube([(x,0,curve(x)) for x in [-w/2+i*w/30 for i in range(31)]], .006), 'goma')
    for k in range(10):
        x=-w*.45+k*w*.1; z=curve(x)
        piece.add(g.tube([(x,0,z),(x,0,z-.08)], .005), 'goma')
        piece.add(g.lathe([(.013,0),(.013,.035)], 20,at=(x,0,z-.1)), 'metal')
        piece.add(g.sphere(.032,at=(x,0,z-.13),segments=20), 'blanco')


def pendant(piece,spec):
    w,d,h=dims(spec); elev=spec['params']['elev']/1000
    piece.add(g.lathe([(.065,0),(.065,.025)], 24,at=(0,0,elev+h-.025)), 'metal')
    piece.add(g.tube([(0,0,elev+h),(0,0,elev+.2)], .006), 'goma')
    piece.add(g.lathe([(w*.5,0),(w*.5,.015),(w*.38,.15),(.03,.23)], 48,at=(0,0,elev)), 'metal')
    piece.add(g.sphere(.035,at=(0,0,elev+.045),segments=20), 'blanco')


def ac(piece,spec):
    w,d,h=dims(spec); p=spec['params']; elev=p.get('elev',0)/1000
    piece.add(g.box(w,d,h,.025,5,at=(0,0,elev)), 'blanco')
    if p.get('outdoor'):
        r=h*.38
        piece.add(g.transform(g.lathe([(r,0),(r,.008)], 40),rot=(math.pi/2,0,0),
                              loc=(-w*.12,-d/2-.01,elev+h*.52)), 'goma')
        for k in range(20):
            a=k*math.tau/20
            piece.add(g.tube([(-w*.12,-d/2-.025,elev+h*.52),
                              (-w*.12+r*math.cos(a),-d/2-.025,elev+h*.52+r*math.sin(a))], .003), 'inox')
        for x in (-w*.37,w*.37):
            piece.add(g.box(.08,d,.03,.005,2,at=(x,0,0)), 'metal')
    else:
        piece.add(g.box(w*.9,.008,h*.17,.008,3,at=(0,-d/2-.009,elev+h*.08)), 'goma')
        for k in range(3):
            piece.add(g.box(w*.89,.028,.005,.002,2,at=(0,-d/2-.016,elev+h*(.09+k*.035))), 'blanco')
        piece.add(g.box(.04,.002,.015,at=(w*.3,-d/2-.003,elev+h*.6)), 'vidrio')


BUILDERS = {'park_bench':park_bench,'bin':bin,'streetlight':streetlight,'lights':lights,'pendant':pendant,'ac':ac}
