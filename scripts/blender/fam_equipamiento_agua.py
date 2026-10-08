"""Piscina, estanque y fuente: bordes, vaso, agua ondulada y accesorios."""
import math
import random
import hk_geo as g


def water(p,w,d,z):
    p.add(g.surface(48,32,lambda u,v: ((u-.5)*w,(v-.5)*d,z+.006*math.sin(u*math.pi*15+v*12)*math.sin(v*math.pi*18))),'agua')


def pool(p,spec):
    w,d,h=(v/1000 for v in spec['dims']); rim=h*.78; thick=.13
    p.add(g.box(w,d,.08,.03),'blanco')
    for y in [-d/2+thick/2,d/2-thick/2]:
        p.add(g.box(w,thick,rim,.025,at=(0,y,0)),'blanco')
        p.add(g.box(w+.05,.2,.06,.025,at=(0,y,rim)),'piedra')
    for x in [-w/2+thick/2,w/2-thick/2]:
        p.add(g.box(thick,d,rim,.025,at=(x,0,0)),'blanco')
        p.add(g.box(.2,d,.06,.025,at=(x,0,rim)),'piedra')
    # Juntas del revestimiento exterior y perfiles de refuerzo.
    for i in range(max(2,int(w/.35))):
        x=-w/2+(i+.5)*w/max(2,int(w/.35))
        for y in [-d/2-.003,d/2+.003]: p.add(g.box(.012,.008,rim-.1,.002,at=(x,y,.05)),'inox')
    water(p,w-.28,d-.28,rim-.1)
    for x in [w*.27,w*.27+.42]:
        p.add(g.tube([(x,-d/2+.32,.1),(x,-d/2+.32,h-.1),(x,-d/2+.18,h),
                     (x,-d/2-.1,h),(x,-d/2-.18,h-.1),(x,-d/2-.18,.02)],.022,12),'inox')
    for z in [.2,.45,.7,.95]:
        if z<rim: p.add(g.box(.45,.16,.04,.012,at=(w*.27+.21,-d/2+.32,z)),'inox')


def pond(p,spec):
    w,d,h=(v/1000 for v in spec['dims']); rng=random.Random(77)
    basin=g.lathe([(0,0),(.45,0),(.5,.2),(.48,1),(.42,1),(.4,.18),(0,.18)],48)
    p.add(g.transform(basin,scale=(w,d,h)),'piedra')
    # Superficie elíptica; el borde irregular se compone de piedras distintas.
    disk=g.surface(48,12,lambda u,v:(math.cos(u*math.tau)*v*w*.42,math.sin(u*math.tau)*v*d*.42,h*.73+.003*math.sin(u*25+v*40)))
    p.add(disk,'agua')
    for i in range(22):
        a=i*math.tau/22
        p.add(g.transform(g.sphere(.13,segments=16),scale=(1.2,.8,.65),loc=(math.cos(a)*w*.46,math.sin(a)*d*.46,h*.87+rng.uniform(-.025,.025))),'piedra')
    # Hojas de nenúfar sobre el agua, con nervio central.
    for x,y,r in [(-.4,.15,.17),(-.2,.35,.13),(.5,.1,.12)]:
        obj=p.add(g.surface(20,6,lambda u,v,x=x,y=y,r=r:(x+math.cos(.14+u*(math.tau-.28))*v*r,y+math.sin(.14+u*(math.tau-.28))*v*r,h*.75+.004*v)),'madera')
        obj.data.materials.clear()
        mat=p.material('madera').copy(); mat.name='nenufar'
        bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        for link in list(mat.node_tree.links):
            if link.to_socket==bsdf.inputs['Base Color']: mat.node_tree.links.remove(link)
        bsdf.inputs['Base Color'].default_value=(.05,.16,.03,1)
        obj.data.materials.append(mat)


def fountain(p,spec):
    w,d,h=(v/1000 for v in spec['dims'])
    p.add(g.lathe([(0,0),(w*.42,0),(w*.48,.08),(w*.5,.2),(w*.47,.24),(w*.4,.16),(0,.13)],48),'piedra')
    p.add(g.lathe([(0,.12),(.16,.12),(.11,h*.5),(.23,h*.57),(.31,h*.63),(.29,h*.68),(.09,h*.59),(.07,h*.92),(0,h)],40),'piedra')
    p.add(g.lathe([(0,.17),(w*.43,.17),(0,.18)],48),'agua')
    for i in range(12):
        a=i*math.tau/12
        path=[(math.cos(a)*(.27+.15*t),math.sin(a)*(.27+.15*t),h*.65-(h*.65-.17)*t*t) for t in [k/12 for k in range(13)]]
        p.add(g.tube(path,.004,5),'agua')


BUILDERS={'pool':pool,'pond':pond,'fountain':fountain}
