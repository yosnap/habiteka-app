import type { Furniture } from './schema';

export type VehicleType = 'compact' | 'sedan' | 'suv' | 'van' | 'unspecified';
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  compact: 'coche compacto', sedan: 'berlina', suv: 'SUV', van: 'furgoneta', unspecified: 'vehículo',
};
const catalogTypes: Record<string, VehicleType> = {
  'habiteka:outdoor:coche': 'compact', 'habiteka:outdoor:coche:turismo-3d': 'sedan',
  'habiteka:outdoor:coche:suv': 'suv', 'habiteka:outdoor:coche:furgoneta': 'van',
  'habiteka:model:turismo_compacto_exterior': 'compact', 'habiteka:model:turismo_berlina_exterior': 'sedan',
  'habiteka:model:vehiculo_suv_exterior': 'suv', 'habiteka:model:furgoneta_exterior': 'van',
};
const kindTypes: Record<string, VehicleType> = {
  'model-turismo_compacto_exterior': 'compact', 'model-turismo_berlina_exterior': 'sedan',
  'model-vehiculo_suv_exterior': 'suv', 'model-furgoneta_exterior': 'van',
};
/** El catálogo fija el tipo, aunque el usuario cambie el nombre o las medidas. No inferirlo por tamaño. */
export const vehicleType = (item: Pick<Furniture, 'catalogId' | 'kind'>): VehicleType =>
  catalogTypes[item.catalogId ?? ''] ?? kindTypes[item.kind] ?? 'unspecified';
export const isVehicle = (item: Pick<Furniture, 'catalogId' | 'kind'>): boolean =>
  vehicleType(item) !== 'unspecified' || /^(coche|auto|autom[oó]vil|veh[ií]culo)$/i.test(item.kind);
