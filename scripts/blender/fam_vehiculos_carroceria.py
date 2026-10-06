"""Carrocerías continuas con perfiles por vehículo y pasos de rueda abiertos. Metros, Z arriba, frente -Y."""
import math
import bmesh
import hk_geo as g


# Posición longitudinal, altura relativa del techo, anchura relativa de su hombro.
PROFILES = {
    'compact': [(-.50,.43,.75),(-.46,.49,.92),(-.28,.52,.96),(-.22,.60,.94),
                (-.08,.94,.78),(.10,1,.76),(.28,.98,.78),(.39,.85,.87),(.47,.61,.93),(.50,.45,.80)],
    'saloon': [(-.50,.40,.75),(-.46,.47,.92),(-.29,.51,.96),(-.20,.55,.95),
               (-.07,.94,.78),(.12,1,.75),(.24,.96,.78),(.37,.60,.94),(.46,.53,.94),(.50,.44,.80)],
    'suv': [(-.50,.43,.79),(-.46,.51,.94),(-.28,.55,.97),(-.20,.62,.95),
            (-.08,.94,.81),(.08,.975,.81),(.29,.975,.82),(.40,.92,.85),(.48,.64,.96),(.50,.49,.84)],
    'van': [(-.50,.43,.79),(-.46,.51,.92),(-.40,.55,.96),(-.28,.93,.86),
            (-.19,1,.87),(.08,1,.90),(.38,1,.90),(.47,.99,.90),(.50,.97,.87)],
}


def interpolate(rows, t, column):
    """Hermite con tangentes limitadas: suave sin abollar el capó ni exceder el techo."""
    for i in range(len(rows)-1):
        if rows[i][0] <= t <= rows[i+1][0]:
            a,b = rows[i],rows[i+1]
            span = b[0]-a[0]; u=(t-a[0])/span
            slope=(b[column]-a[column])/span
            before=(a[column]-rows[max(0,i-1)][column])/(a[0]-rows[max(0,i-1)][0]) if i else slope
            after=(rows[min(len(rows)-1,i+2)][column]-b[column])/(rows[min(len(rows)-1,i+2)][0]-b[0]) if i+2<len(rows) else slope
            ma = 0 if before*slope<=0 else math.copysign(min(abs(before),abs(slope)),slope)
            mb = 0 if after*slope<=0 else math.copysign(min(abs(after),abs(slope)),slope)
            return (2*u**3-3*u*u+1)*a[column]+(u**3-2*u*u+u)*ma*span+(-2*u**3+3*u*u)*b[column]+(u**3-u*u)*mb*span
    return rows[0 if t<rows[0][0] else -1][column]


class Body:
    def __init__(self, spec):
        self.w,self.d,self.h=(v/1000 for v in spec['dims'])
        self.kind=spec['params']['vehicle']; self.rows=PROFILES[self.kind]
        self.half=self.w*.447; self.radius={'compact':.30,'saloon':.32,'suv':.355,'van':.36}[self.kind]
        self.axles=[-self.d*.30,self.d*(.29 if self.kind=='compact' else .30)]
        self.base=.155 if self.kind!='suv' else .205

    def width(self,t):
        return self.half*(1-.13*(abs(t)/.5)**8)

    def top(self,t):
        return self.h*interpolate(self.rows,t,1)-.018

    def roof_width(self,t):
        return self.width(t)*interpolate(self.rows,t,2)

    def belt(self,t):
        return min(self.top(t)-.085,self.h*(.50 if self.kind=='van' else .54))

    def arch_bottom(self,y):
        r=self.radius+.035
        for axle in self.axles:
            delta=abs(y-axle)
            if delta<r: return self.radius+math.sqrt(r*r-delta*delta)
        return self.base

    def side(self,t,v,side,offset=.004):
        """Superficie entre cintura y techo, utilizada también por cada ventana."""
        x=self.width(t)*.97*(1-v)+self.roof_width(t)*v
        z=self.belt(t)*(1-v)+(self.top(t)-.025)*v
        return (side*(x+offset),t*self.d,z)

    def roof(self,t,u,offset=.004):
        x=(u*2-1)*self.roof_width(t)
        q=abs(u*2-1)
        sections=[(0,.018),(.65,.005),(.93,-.014),(1,-.025)]
        for (a,za),(b,zb) in zip(sections,sections[1:]):
            if a<=q<=b:
                crown=za+(zb-za)*(q-a)/(b-a)
                break
        return (x,t*self.d,self.top(t)+crown+offset)

    def end_y(self,t,x):
        blend=max(0,(abs(t)-.40)/.10)**2
        return t*self.d-math.copysign(.10*blend*(abs(x)/self.half)**4,t)

    def lower_side(self,t,z,side,offset=.004):
        return (side*(self.width(t)+offset),t*self.d,z)


def shell(p,body):
    bm=bmesh.new(); rings=[]
    for i in range(97):
        t=-.5+i/96; y=t*body.d; x=body.width(t); z=body.top(t); belt=body.belt(t)
        bottom=body.arch_bottom(y); rw=body.roof_width(t)
        half=[(0,body.base),(x*.65,body.base),(x*.78,bottom),(x*.96,bottom),
              (x,bottom+.012),(x,max(bottom+.018,belt-.08)),(x*.97,belt),
              (rw,z-.025),(rw*.93,z-.014),(rw*.65,z+.005),(0,z+.018)]
        coords=[(a,body.end_y(t,a),b) for a,b in half]+[(-a,body.end_y(t,a),b) for a,b in reversed(half[1:-1])]
        rings.append([bm.verts.new(point) for point in coords])
    for a,b in zip(rings,rings[1:]):
        for k in range(len(a)): bm.faces.new((a[k],a[(k+1)%len(a)],b[(k+1)%len(a)],b[k]))
    bm.faces.new(tuple(reversed(rings[0]))); bm.faces.new(tuple(rings[-1]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    p.add(bm,'pintura',sharp=30)
    p.add(g.box(body.half*1.4,body.d*.72,.10,.045,at=(0,0,body.base)),'goma')


def pane(p,body,t0,t1,side,v0=.12,v1=.85):
    fn=lambda u,v: body.side(t0+(t1-t0)*u,v0+(v1-v0)*v,side)
    mesh=g.surface(16,6,fn)
    if side<0: bmesh.ops.reverse_faces(mesh,faces=mesh.faces[:])
    p.add(mesh,'vidrio',sharp=0)
    edges=[fn(k/16,0) for k in range(17)]+[fn(1,k/6) for k in range(1,7)]+[fn(1-k/16,1) for k in range(1,17)]+[fn(0,1-k/6) for k in range(1,6)]
    p.add(g.tube(edges,.007,4,closed=True),'goma')


def glazing(p,body):
    kind=body.kind
    side_ranges={'compact':[(-.17,.07),(.09,.34)],'saloon':[(-.16,.07),(.09,.29)],
                 'suv':[(-.16,.06),(.08,.29),(.31,.41)],'van':[(-.34,-.11)]}[kind]
    for side in [-1,1]:
        for a,b in side_ranges: pane(p,body,a,b,side)
    front={'compact':(-.225,-.083),'saloon':(-.205,-.073),'suv':(-.205,-.085),'van':(-.405,-.275)}[kind]
    rear={'compact':(.34,.455),'saloon':(.26,.367),'suv':(.40,.471),'van':None}[kind]
    for extent in [front,rear]:
        if not extent: continue
        a,b=extent
        fn=lambda u,v,a=a,b=b: body.roof(a+(b-a)*v,.06+.88*u,.012)
        p.add(g.surface(16,18,fn),'vidrio',sharp=0)
        path=[fn(k/16,0) for k in range(17)]+[fn(1,k/16) for k in range(1,17)]+[fn(1-k/16,1) for k in range(1,17)]+[fn(0,1-k/16) for k in range(1,16)]
        p.add(g.tube(path,.008,4,closed=True),'goma')
    # Limpiaparabrisas sobre el vidrio, siguiendo la misma superficie.
    a,b=front
    for u in [.26,.62]:
        p.add(g.tube([body.roof(a+(b-a)*.12,u,.017),body.roof(a+(b-a)*.35,u+.13,.017)],.006,6),'goma')


def panel_seams(p,body):
    kind=body.kind
    cuts={'compact':[-.175,.075,.34],'saloon':[-.16,.08,.31],'suv':[-.16,.07,.31],'van':[-.34,-.1,.37]}[kind]
    for side in [-1,1]:
        for t in cuts:
            low=max(body.base+.06,body.arch_bottom(t*body.d)+.03)
            high=body.belt(t)
            if low<high:
                p.add(g.tube([body.lower_side(t,low,side),body.lower_side(t,high,side)],.003,6),'goma')
        for a,b in zip(cuts,cuts[1:]):
            ts=[a+(b-a)*k/24 for k in range(25)]
            p.add(g.tube([body.lower_side(t,max(body.base+.04,body.arch_bottom(t*body.d)+.014),side) for t in ts],.003,4),'goma')
            if kind=='van' and a>-.15: continue
            t=b-.045
            p.add(g.box(.015,.12,.028,.011,at=(side*body.width(t),t*body.d,body.belt(t)-.10)),'inox')
        if kind=='van':
            # Puerta corredera y guía metálica sobre el panel de carga.
            p.add(g.tube([body.lower_side(-.075,body.h*.58,side),body.lower_side(.35,body.h*.58,side)],.009,6),'metal')
        for axle in body.axles:
            path=[]
            r=body.radius+.035
            for k in range(33):
                angle=math.pi*k/32
                y=axle+math.cos(angle)*r
                path.append((side*(body.width(y/body.d)+.003),y,body.radius+math.sin(angle)*r))
            p.add(g.tube(path,.012 if kind!='suv' else .021,6),'goma' if kind=='suv' else 'pintura')
