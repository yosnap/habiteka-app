"""Neumáticos con dibujo, llantas, frenos, ópticas y piezas de carrocería a escala física."""
import math
import hk_geo as g


def wheels(p,body):
    r=body.radius; tread=.205 if body.kind in ['suv','van'] else .18
    for side in [-1,1]:
        for axle in body.axles:
            x=side*(body.half-tread*.48)
            profile=[(r*.64,-tread/2),(r*.86,-tread*.55),(r*.97,-tread*.40),(r,-tread*.28),
                     (r,tread*.28),(r*.97,tread*.40),(r*.86,tread*.55),(r*.64,tread/2),(r*.64,-tread/2)]
            tyre=g.transform(g.lathe(profile,64),rot=(0,math.pi/2,0),loc=(x,axle,r))
            p.add(tyre,'goma',sharp=0)
            outer=x+side*tread*.52
            # Surcos repetidos en la banda: geometría real, no ruido pintado en la llanta.
            for k in range(48):
                a=k*math.tau/48
                block=g.box(tread*.80,.008,.006)
                p.add(g.transform(block,rot=(a,0,0),loc=(x,axle-math.sin(a)*(r-.003),r+math.cos(a)*(r-.003))),'goma')
            rim=[(r*.61,-.006),(r*.68,-.006),(r*.70,.008),(r*.70,.017),(r*.64,.017),(r*.61,-.006)]
            rot=(0,side*math.pi/2,0)
            p.add(g.transform(g.lathe(rim,64),rot=rot,loc=(outer,axle,r)),'inox',sharp=0)
            # El disco queda detrás de los radios, visible entre ellos.
            disc=[(0,0),(r*.58,0),(r*.58,.012),(0,.012)]
            p.add(g.transform(g.lathe(disc,48),rot=rot,loc=(outer-side*.04,axle,r)),'freno')
            for k in range(10):
                a=k*math.tau/10
                point=lambda radius,theta,offset=0: (outer+side*offset,axle+math.cos(theta)*radius,r+math.sin(theta)*radius)
                p.add(g.tube([point(r*.12,a,.015),point(r*.42,a+.08,.013),point(r*.65,a+.12,.008)],.015,6),'inox')
            hub=[(0,0),(.052,0),(.052,.025),(.045,.032),(0,.032)]
            p.add(g.transform(g.lathe(hub,24),rot=rot,loc=(outer,axle,r)),'metal',sharp=0)
            for k in range(5):
                a=k*math.tau/5
                p.add(g.sphere(.007,at=(outer+side*.026,axle+math.cos(a)*.036,r+math.sin(a)*.036),segments=8),'inox')
            p.add(g.box(.025,r*.23,r*.35,.012,at=(outer-side*.025,axle+r*.36,r*.86)),'metal')


def nose(p,body):
    w,d,h=body.w,body.d,body.h
    front=-d*.498
    # Paragolpes a juego con la carrocería y toma de aire inferior separada.
    p.add(g.box(w*.77,.105,.11,.045,segments=5,at=(0,front+.055,h*.24)),'pintura')
    p.add(g.box(w*.67,.031,.07,.021,segments=3,at=(0,front+.01,h*.18)),'goma')
    p.add(g.box(w*.43,.025,.12,.028,segments=4,at=(0,front-.005,h*.30)),'goma')
    for i in range(13):
        x=(i-6)*w*.029
        p.add(g.box(.009,.018,.087,.004,at=(x,front-.022,h*.31)),'metal')
    for side in [-1,1]:
        # Óptica con alojamiento oscuro y dos bandas LED en el difusor.
        x=side*w*.27; optics_y=body.end_y(-.5,x)-.006; optics_z=h*.32
        p.add(g.box(w*.18,.065,.065,.022,segments=4,at=(x,optics_y+.022,optics_z)),'goma')
        p.add(g.box(w*.16,.035,.050,.017,segments=4,at=(x,optics_y+.003,optics_z+.007)),'faro')
        for z in [optics_z+.016,optics_z+.039]:
            p.add(g.box(w*.14,.008,.005,.002,at=(x,optics_y-.013,z)),'led')
        p.add(g.box(w*.11,.025,.065,.018,at=(side*w*.33,front+.01,h*.26)),'goma')
    p.add(g.box(.42,.011,.09,.006,at=(0,front-.027,h*.255)),'blanco')
    # Nervaduras suaves del capó; acompañan su pendiente y no son barras en relieve.
    from_t=-.45; to_t=-.245 if body.kind!='van' else -.405
    for side in [-1,1]:
        path=[]
        for k in range(30):
            t=from_t+(to_t-from_t)*k/29
            path.append(body.roof(t,.5+side*.28,.002))
        p.add(g.tube(path,.0025,5),'pintura')


def rear(p,body):
    w,d,h=body.w,body.d,body.h; back=d*.498
    p.add(g.box(w*.78,.11,.10,.04,segments=4,at=(0,back-.05,h*.22)),'goma' if body.kind in ['suv','van'] else 'pintura')
    if body.kind=='van':
        for side in [-1,1]:
            x=side*w*.34; lamp_y=body.end_y(.5,x)+.003
            p.add(g.box(.10,.030,h*.22,.027,at=(x,lamp_y,h*.42)),'piloto')
            hinge_x=side*w*.33; hinge_y=body.end_y(.5,hinge_x)+.005
            for z in [h*.37,h*.77]:p.add(g.box(.05,.015,.08,.01,at=(hinge_x,hinge_y,z)),'metal')
        p.add(g.tube([(0,back+.004,h*.27),(0,back+.004,h*.97)],.003,6),'goma')
        p.add(g.box(.13,.019,.025,.01,at=(.07,back+.015,h*.48)),'metal')
    else:
        for side in [-1,1]:
            x=side*w*.265; lamp_y=body.end_y(.5,x)+.001
            p.add(g.box(w*.16,.035,.07,.02,segments=4,at=(x,lamp_y,h*.38)),'piloto')
            p.add(g.box(w*.13,.007,.008,.002,at=(x,lamp_y+.019,h*.392)),'led-rojo')
            p.add(g.box(.08,.09,.04,.015,at=(side*w*.28,back-.04,h*.20)),'inox')
    p.add(g.box(.42,.012,.09,.006,at=(0,back+.017,h*.29)),'blanco')


def mirrors_and_roof(p,body):
    t=-.18 if body.kind!='van' else -.32
    for side in [-1,1]:
        anchor=body.side(t,.2,side,.003)
        x=side*(body.w*.46)
        z=body.belt(t)+.08
        p.add(g.tube([anchor,(x,t*body.d,z+.03)],.018,10),'goma')
        p.add(g.box(body.w*.075,.19,.10,.04,segments=5,at=(x,t*body.d,z)),'pintura')
        p.add(g.box(body.w*.064,.006,.071,.018,segments=4,at=(x,t*body.d+.095,z+.015)),'espejo')
    if body.kind=='suv':
        for side in [-1,1]:
            path=[body.roof(-.04+k*.40/20,.5+side*.32,.022) for k in range(21)]
            p.add(g.tube(path,.013,8),'metal')
            for t in [-.04,.35]:
                a=body.roof(t,.5+side*.32,.007);b=body.roof(t,.5+side*.32,.022)
                p.add(g.tube([a,b],.015,8),'goma')
    elif body.kind!='van':
        pos=body.roof(.19,.5,.008)
        p.add(g.box(.055,.105,.035,.015,at=pos),'pintura')


def details(p,body):
    wheels(p,body)
    nose(p,body)
    rear(p,body)
    mirrors_and_roof(p,body)
