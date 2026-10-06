/**
 * Estancias infantil, recibidor, lavadero y garaje: se reconocen por el nombre rotulado, el catálogo las filtra con sus
 * piezas (también las que sirven en otra estancia) y Amueblar deja el garaje libre salvo que se pida.
 */
import { describe, expect, it } from 'vitest';
import type { PlanZone } from '@/lib/contracts';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { roomWallFaces } from '@/lib/editor-document/room-wall-faces';
import { FURNITURE_ROOMS, getFurnitureCatalogEntry, searchFurnitureCatalog, type FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { furnitureRooms, withProductRoom } from '@/lib/editor-document/furniture-rooms';
import { roomFromZoneName, roomUseLabel, roomUseRules } from '@/lib/editor-document/room-use';
import { placeFurniture } from '@/server/ai/sketch/place-furniture';
import { parseNativeDesignProposalDetailed } from '@/server/agent/editor-v2/native-design-proposal';
import { matchSketchItem } from '@/server/agent/editor-v2/sketch-catalog-match';

const entry = (id: string) => getFurnitureCatalogEntry(`habiteka:furniture:${id}`)!;

describe('uso de la estancia por su nombre', () => {
  it('reconoce las estancias nuevas con y sin tildes', () => {
    for (const name of ['Dormitorio infantil', 'Habitación de los niños', 'Cuarto del bebé', 'Sala de juegos', 'Juvenil']) {
      expect(roomFromZoneName(name), name).toBe('infantil');
    }
    for (const name of ['Recibidor', 'Entrada', 'Hall', 'Vestíbulo']) expect(roomFromZoneName(name), name).toBe('recibidor');
    for (const name of ['Lavadero', 'Lavandería', 'Tendedero', 'Cuarto de plancha']) expect(roomFromZoneName(name), name).toBe('lavadero');
    for (const name of ['Garaje', 'Cochera', 'Parking 2', 'Aparcamiento']) expect(roomFromZoneName(name), name).toBe('garaje');
  });

  it('resuelve los nombres compuestos por lo más concreto y no cambia los de antes', () => {
    expect(roomFromZoneName('Cocina-lavadero')).toBe('cocina');
    expect(roomFromZoneName('Porche de entrada')).toBe('exterior');
    expect(roomFromZoneName('Dormitorio 2')).toBe('dormitorio');
    expect(roomFromZoneName('Salón-comedor')).toBe('comedor');
    expect(roomFromZoneName('Sala de estar')).toBe('salon');
    expect(roomFromZoneName('Camino')).toBeNull();
    expect(roomUseLabel('Garaje')).toBe('Garaje');
    expect(roomUseLabel('Estancia')).toBe('');
  });

  it('da a Amueblar solo las reglas de los usos presentes', () => {
    expect(roomUseRules(['Salón', 'Dormitorio'])).toBe('');
    const rules = roomUseRules(['Garaje', 'Dormitorio infantil']);
    expect(rules).toMatch(/Garaje: es para el coche/);
    expect(rules).toMatch(/Infantil: una cama individual/);
    expect(rules).not.toMatch(/Lavadero:/);
  });
});

describe('estancias del catálogo', () => {
  it('ofrece las trece estancias con su nombre', () => {
    expect(Object.keys(FURNITURE_ROOMS)).toHaveLength(13);
    expect(FURNITURE_ROOMS).toMatchObject({ infantil: 'Infantil', recibidor: 'Recibidor', lavadero: 'Lavadero', garaje: 'Garaje' });
  });

  it('mueve el lavado al lavadero y la entrada al recibidor, y los ofrece donde también se usan', () => {
    expect(entry('lavadora').room).toBe('lavadero');
    expect(furnitureRooms(entry('lavadora'))).toEqual(expect.arrayContaining(['lavadero', 'bano', 'cocina']));
    expect(entry('pila-lavadero').room).toBe('lavadero');
    expect(entry('zapatero').room).toBe('recibidor');
    expect(entry('felpudo').room).toBe('recibidor');
    expect(furnitureRooms(entry('cama-individual'))).toEqual(['dormitorio', 'infantil']);
    expect(furnitureRooms(entry('cama-doble'))).toEqual(['dormitorio']);
  });

  it('filtra cada estancia nueva con sus piezas', () => {
    const ids = (room: string) => searchFurnitureCatalog('', room).map((item) => item.id);
    expect(ids('infantil')).toEqual(expect.arrayContaining(['habiteka:furniture:cama-individual', 'habiteka:furniture:escritorio', 'habiteka:furniture:armario']));
    expect(searchFurnitureCatalog('', 'infantil').every((item) => item.profile !== 'bed' || item.widthMm <= 1300)).toBe(true);
    expect(ids('recibidor')).toEqual(expect.arrayContaining(['habiteka:furniture:zapatero', 'habiteka:furniture:felpudo']));
    expect(ids('lavadero')).toEqual(expect.arrayContaining(['habiteka:furniture:lavadora', 'habiteka:furniture:secadora', 'habiteka:furniture:pila-lavadero']));
    const garage = searchFurnitureCatalog('', 'garaje');
    expect(garage.length).toBeGreaterThan(0);
    expect(garage.every((item) => item.profile === 'shelf')).toBe(true);
    // La búsqueda por texto encuentra también la estancia secundaria.
    expect(searchFurnitureCatalog('lavadora baño').some((item) => item.id === 'habiteka:furniture:lavadora')).toBe(true);
  });

  it('lleva a su estancia los muebles fabricados por su producto, salvo los sanitarios', () => {
    const base = entry('zapatero');
    const made = (productId: string, profile: FurnitureCatalogEntry['profile'], room: FurnitureCatalogEntry['room']) =>
      withProductRoom({ ...base, id: `habiteka:model:${productId}`, productId: `habiteka-${productId}`, profile, room });
    expect(made('consola_roble', 'table', 'salon').room).toBe('recibidor');
    expect(made('lavadora_carga_frontal', 'appliance', 'cocina').room).toBe('lavadero');
    expect(made('cuna_madera', 'bed', 'dormitorio').room).toBe('infantil');
    expect(made('estanteria_metalica', 'shelf', 'salon').room).toBe('garaje');
    expect(made('lavabo_consola', 'sink', 'bano').room).toBe('bano');
    expect(made('sofa_nordico', 'sofa', 'salon').room).toBe('salon');
  });
});

describe('muebles del boceto en las estancias nuevas', () => {
  const zone = (name: string): PlanZone => ({ id: 'z', name, walls: [], apertures: [], dimensions: [],
    outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }] });
  const bed = { tipo: 'bed' as const, bbox: { minX: .05, minY: .05, maxX: .21, maxY: .31 }, rotacionDeg: 0 as const };

  it('reconoce los objetos de las estancias nuevas sin confundirlos con otros', () => {
    expect(matchSketchItem('armario con espejo')).toEqual({ catalogId: 'habiteka:furniture:armario' });
    expect(matchSketchItem('estantería metálica')?.catalogId).toMatch(/estanteria[-_](acero|metal)/);
    // Lo que solo traen algunas familias apunta a una pieza suya, o se avisa como que falta; nunca a otra cosa.
    for (const [name, pattern] of [['cuna', /cuna/], ['consola', /consola/], ['perchero', /perchero/], ['tendedero', /tendedero/]] as const) {
      const match = matchSketchItem(name);
      if (match) expect(match.catalogId, name).toMatch(pattern);
    }
  });

  it('en un cuarto infantil una cama dibujada es individual', () => {
    const { furniture } = placeFurniture([bed], { mmPerUnitX: 10000, mmPerUnitY: 8000 }, [zone('Dormitorio infantil')]);
    expect(furniture).toHaveLength(1);
    expect(getFurnitureCatalogEntry(furniture[0]!.catalogId)!.widthMm).toBeLessThanOrEqual(1300);
  });
});

describe('Amueblar en el garaje', () => {
  const garage = () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 6000 }, { x: 0, y: 6000 }], true);
    doc.labels.push({ id: 'garaje', text: 'Garaje', x: 2500, y: 3000 });
    return doc;
  };
  const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const, designScope: 'all' as const };
  const answer = (doc: ReturnType<typeof garage>) => {
    const wall = roomWallFaces(doc, deriveRooms(doc)[0]!, 'E1', []).find((face) => face.side === 'izquierda')!.id;
    return { summary: '', materials: {}, roomFinishes: [], kitchens: [], fixedFinishes: [], furniture: [
      { catalogId: 'habiteka:furniture:sofa-3', wall, alongMm: 2000, cxMm: 0, cyMm: 0, rotation: 0, reason: '' },
      { catalogId: 'habiteka:furniture:estanteria-oficina', wall, alongMm: 4800, cxMm: 0, cyMm: 0, rotation: 0, reason: '' },
    ] };
  };

  it('deja el garaje libre para el coche salvo una estantería metálica', () => {
    const doc = garage();
    const { proposal } = parseNativeDesignProposalDetailed(answer(doc), 'moderno', doc, options);
    expect(proposal.furniture.map((item) => item.catalogId)).toEqual(['habiteka:furniture:estanteria-oficina']);
    expect(proposal.summary).toMatch(/el garaje se deja libre para el coche/);
  });

  it('amuebla el garaje si el cliente lo pide', () => {
    const doc = garage();
    const { proposal } = parseNativeDesignProposalDetailed(answer(doc), 'moderno', doc, options, null, 'Pon un sofá en el garaje');
    expect(proposal.furniture.map((item) => item.catalogId)).toContain('habiteka:furniture:sofa-3');
  });
});
