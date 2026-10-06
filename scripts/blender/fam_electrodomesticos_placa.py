"""Placa vitrocerámica: cristal biselado, cuatro zonas y controles táctiles. Frente -Y, Z arriba."""
import math
import hk_geo as geo


def ceramic_hob(piece, spec):
    w,d,h=(value/1000 for value in spec['dims'])
    piece.add(geo.box(w-.008,d-.008,.002,.0008,at=(0,0,0)),'carcasa')
    piece.add(geo.box(w,d,.004,.0015,segments=5,at=(0,0,.002)),'marco')
    piece.add(geo.box(w-.003,d-.003,h-.004,.0015,segments=5,at=(0,0,.004)),'vidrio')
    z=h+.0002

    def circle(x,y,r,thickness=.0008):
        # Una corona abierta: lathe tapa los extremos y convertiría la marca en un disco sólido.
        def point(u,v):
            radius=r-v*thickness; angle=u*math.tau
            return (x+radius*math.cos(angle),y+radius*math.sin(angle),z+.0003)
        piece.add(geo.surface(96,1,point),'marcas')

    for x,y,r,double in [(-w*.25,-d*.17,.084,True),(w*.25,-d*.17,.072,False),
                          (-w*.25,d*.24,.072,False),(w*.25,d*.24,.096,True)]:
        circle(x,y,r)
        if double: circle(x,y,r-.020,.0006)
        # Pequeño punto junto a cada zona, como la impresión de selección de la placa.
        piece.add(geo.lathe([(0,z),(.002,z),(.002,z+.0003),(0,z+.0003)],24,at=(x,y,0)),'marcas')

    y=-d*.40
    # Encendido, selección de cuatro zonas y ajuste + / −, impresos en el mismo cristal.
    circle(-w*.30,y,.008,.001)
    piece.add(geo.box(.001,.009,.0003,at=(-w*.30,y+.005,z)),'marcas')
    for i in range(4):
        x=-w*.17+i*w*.09
        circle(x,y,.005,.0007)
    for x in [w*.23,w*.33]:
        piece.add(geo.box(.012,.001,.0003,at=(x,y,z)),'marcas')
    piece.add(geo.box(.001,.012,.0003,at=(w*.33,y,z)),'marcas')
    # Marcas de la banda de potencia: independientes de la pintura del aparato.
    for i in range(9):
        piece.add(geo.box(.001,.002+i*.00025,.0003,at=(-w*.08+i*w*.018,y-.019,z)),'marcas')
