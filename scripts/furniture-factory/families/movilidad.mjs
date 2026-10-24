/** Vehículos sin marcas, bicicletas y motos para garajes y exteriores. */
export const FAMILY = { id: 'movilidad', label: 'Vehículos, motos y bicicletas', room: 'exterior', dependsOn: ['equipamiento_vehiculos', 'vehiculos_carroceria', 'vehiculos_detalles', 'movilidad_dos_ruedas'] };
const finishes = { pintura: 'veh-azul', goma: 'veh-goma', vidrio: 'veh-cristal', inox: 'ext-inox',
  freno: 'veh-freno', metal: 'ext-metal', faro: 'ext-faro', led: 'veh-led', blanco: 'ext-blanco',
  piloto: 'ext-piloto', 'led-rojo': 'veh-led-rojo', espejo: 'veh-espejo' };
const product = (name, type, label, dims, params = {}, paint = 'veh-azul') => ({
  product: name, type, label, profile: 'decor', style: 'Contemporáneo', params, finishes: { ...finishes, pintura: paint },
  mainSlot: 'pintura', variants: [{ key: 'base', size: `${dims[0] / 1000} × ${dims[1] / 1000} m`, dims, proposal: true }],
});
export const PRODUCTS = [
  product('coche_urbano', 'car', 'Coche urbano de tres puertas', [1650, 3500, 1450], { vehicle: 'compact' }, 'veh-blanco'),
  product('coche_coupe', 'car', 'Coupé deportivo', [1850, 4450, 1300], { vehicle: 'saloon', coupe: true }, 'veh-plata'),
  product('vehiculo_monovolumen', 'car', 'Monovolumen familiar', [1900, 4700, 1850], { vehicle: 'suv' }, 'veh-gris'),
  product('moto_carretera', 'motorcycle', 'Moto de carretera', [780, 2150, 1150]),
  product('moto_trail', 'motorcycle', 'Moto trail', [880, 2200, 1350], { trail: true }, 'veh-blanco'),
  product('scooter_urbano', 'motorcycle', 'Scooter urbano', [740, 1850, 1150], { scooter: true }, 'veh-plata'),
  product('bicicleta_urbana', 'bicycle', 'Bicicleta urbana con cesta', [650, 1800, 1100], { basket: true }, 'veh-blanco'),
  product('bicicleta_montana', 'bicycle', 'Bicicleta de montaña', [720, 1850, 1100], {}, 'veh-azul'),
];
