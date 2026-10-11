"""Piscina, estanque y fuente: bordes, vaso, agua ondulada y accesorios."""
import math
import random
import hk_geo as g


def water(p,w,d,z):
    p.add(g.surface(48,32,lambda u,v: ((u-.5)*w,(v-.5)*d,z+.006*math.sin(u*math.pi*15+v*12)*math.sin(v*math.pi*18))),'agua')


def pool(p,spec):
    """Vaso elevado de paneles de madera, liner azul, coronamiento y escalera a ambos lados."""
    w,d,h=(v/1000 for v in spec['dims']); rim=h-.25; thick=.12
    p.add(g.box(w,d,.06,.02),'madera')
    for y in [-d/2+thick/2,d/2-thick/2]:
        p.add(g.box(w,thick,rim,.018,at=(0,y,0)),'madera')
        p.add(g.box(w,.2,.055,.016,at=(0,y,rim)),'piedra')
        p.add(g.box(w-.24,.008,rim-.1,.002,at=(0,y-math.copysign(thick/2,y),.07)),'liner')
    for x in [-w/2+thick/2,w/2-thick/2]:
        p.add(g.box(thick,d-.24,rim,.018,at=(x,0,0)),'madera')
        p.add(g.box(.2,d,.055,.016,at=(x,0,rim)),'piedra')
        p.add(g.box(.008,d-.24,rim-.1,.002,at=(x-math.copysign(thick/2,x),0,.07)),'liner')
    # Listones horizontales y montantes de refuerzo: detalles legibles en la vista exterior.
    for z in [.08+i*.16 for i in range(max(1,int(rim/.16)))]:
        for sy in [-1,1]: p.add(g.box(w,.012,.008,.002,at=(0,sy*(d/2+.004),z)),'metal')
        for sx in [-1,1]: p.add(g.box(.012,d,.008,.002,at=(sx*(w/2+.004),0,z)),'metal')
    for i in range(max(3,int(w/1.2))):
        x=-w/2+.12+i*(w-.24)/max(1,max(3,int(w/1.2))-1)
        for sy in [-1,1]: p.add(g.box(.07,.04,rim,.008,at=(x,sy*d/2,0)),'madera')
    water(p,w-.28,d-.28,rim-.12)
    cx=w*.27
    for x in [cx-.22,cx+.22]:
        p.add(g.tube([(x,-d/2+.34,.09),(x,-d/2+.34,rim+.03),(x,-d/2+.12,h-.04),
                     (x,-d/2-.12,h-.04),(x,-d/2-.38,rim+.03),(x,-d/2-.38,.02)],.024,14),'inox')
    for z in [.2+i*.25 for i in range(max(1,int(rim/.25)))]:
        for y in [-d/2+.34,-d/2-.38]:
            p.add(g.box(.45,.18,.045,.012,at=(cx,y,z)),'blanco')
            for x in [cx-.22,cx+.22]: p.add(g.box(.06,.21,.025,.005,at=(x,y,z-.02)),'inox')


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
