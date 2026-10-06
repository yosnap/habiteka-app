import { convert, list, numeric, point, record, string, unknownFields, vertexId } from './shared';

/** Adaptación directa de milímetros; el contrato congelado no se modifica. */
export function fromPlano2d(raw: unknown) {
  return convert(raw, (source, doc, issues) => {
    if (source.schemaVersion !== 1) throw new Error('Versión de plano no soportada');
    unknownFields(source, ['schemaVersion', 'zones'], issues);
    const wallIds = new Map<string, string>();
    for (const rawZone of list(source.zones)) {
      const zone = record(rawZone);
      unknownFields(zone, ['id', 'name', 'outline', 'walls', 'apertures', 'dimensions'], issues);
      const outline = list(zone.outline).map((p) => point(p, 1, issues));
      if (outline.length < 3) throw new Error('Contorno de zona incompleto');
      doc.labels.push({ id: string(zone.id), text: string(zone.name),
        x: outline.reduce((sum, p) => sum + p.x, 0) / outline.length,
        y: outline.reduce((sum, p) => sum + p.y, 0) / outline.length });
      for (const rawWall of list(zone.walls)) {
        const w = record(rawWall);
        unknownFields(w, ['id', 'from', 'to', 'thicknessMm'], issues);
        const id = string(w.id);
        const signature = JSON.stringify(w);
        if (wallIds.has(id)) {
          if (wallIds.get(id) !== signature) throw new Error(`Muro ${id} duplicado con geometría distinta`);
          continue;
        }
        wallIds.set(id, signature);
        doc.walls.push({ id, startVertexId: vertexId(doc, point(w.from, 1, issues)),
          endVertexId: vertexId(doc, point(w.to, 1, issues)), thicknessMm: numeric(w.thicknessMm), dimensionalOrigin: 'physical' });
      }
      for (const rawOpening of list(zone.apertures)) {
        const opening = record(rawOpening);
        // El adaptador de importación pasa giro, bisagra y tipo de carpintería a
        // construcción tras migrar el documento; aquí solo se acepta su presencia.
        unknownFields(opening, ['id', 'wallId', 'kind', 'position', 'widthMm', 'swing', 'hinge', 'catalogId'], issues);
        const kind = opening.kind;
        if (kind !== 'puerta' && kind !== 'ventana' && kind !== 'hueco') throw new Error('Tipo de hueco desconocido');
        doc.openings.push({ id: string(opening.id), wallId: string(opening.wallId), kind,
          position: numeric(opening.position), widthMm: numeric(opening.widthMm), dimensionalOrigin: 'physical' });
      }
      for (const rawDimension of list(zone.dimensions)) {
        const dimension = record(rawDimension);
        unknownFields(dimension, ['id', 'from', 'to', 'label'], issues);
        doc.dimensions.push({ id: string(dimension.id), from: point(dimension.from, 1, issues),
          to: point(dimension.to, 1, issues), label: string(dimension.label) });
      }
    }
  });
}
