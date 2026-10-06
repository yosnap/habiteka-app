"""Matas aromáticas y gramíneas: tallos, hojas estrechas curvas y espigas individuales."""
import math
import random
import hk_geo as g


def aromatic(p, spec):
    w,d,h = (v/1000 for v in spec['dims'])
    rng = random.Random(712)
    species = spec['params']['species']
    grass = species == 'grass'
    for i in range(55 if grass else 32):
        az = i*2.39996
        reach = math.sqrt(rng.random())*.45
        x,y = math.cos(az)*w*reach, math.sin(az)*d*reach
        z = h*rng.uniform(.55,1)
        start = (x*.12,y*.12,0)
        end = (x,y,z)
        p.add(g.tube([start,(x*.4,y*.4,z*.55),end],.0015 if grass else .002,5),'hojas')
        if grass:
            for k in range(2):
                theta = az+k*1.7
                p.add(g.surface(10,2,lambda u,v,theta=theta,x=x,y=y,z=z: (
                    x*.2+math.cos(theta)*w*.35*u-math.sin(theta)*(v-.5)*.014*math.sin(math.pi*u),
                    y*.2+math.sin(theta)*d*.35*u+math.cos(theta)*(v-.5)*.014*math.sin(math.pi*u),
                    z*(math.sin(u*math.pi*.7))*.85)), 'hojas')
        else:
            for k in range(7):
                f = .15+k*.085
                for side in [-1,1]:
                    a = az+side*1.4
                    p.add(g.surface(4,2,lambda u,v,f=f,a=a,x=x,y=y,z=z: (
                        x*f+math.cos(a)*.055*u-math.sin(a)*(v-.5)*.009*math.sin(math.pi*u),
                        y*f+math.sin(a)*.055*u+math.cos(a)*(v-.5)*.009*math.sin(math.pi*u),
                        z*f+.025*math.sin(u*math.pi/2))), 'hojas')
        if species != 'rosemary' or i%4 == 0:
            for k in range(4 if grass else 6):
                for side in range(3):
                    a = side*math.tau/3+k*.8
                    radius = .008 if grass else .009
                    p.add(g.sphere(radius, at=(x+math.cos(a)*radius,y+math.sin(a)*radius,z-k*.009),segments=8),'flor')


BUILDERS = {'aromatic': aromatic}
