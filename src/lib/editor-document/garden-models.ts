import type { Furniture } from './schema';

/** Identidad visual compartida por catálogo, planta y escena. La geometría de colisión no cambia. */
export const GARDEN_MODELS: Readonly<Record<string, string>> = {
  'porche-entrada': 'porche_entrada_exterior',
  arbol: 'arbol_platano_400', 'arbol:olivo': 'olivo_jardin_300', 'arbol:naranjo': 'naranjo_280',
  'arbol:pino': 'pino_jardin', 'arbol:cipres': 'cipres_jardin', 'arbol:palmera': 'palmera_jardin',
  arbusto: 'arbusto_100', seto: 'seto_boj_200', 'planta-exterior': 'formio_110',
  'arbusto:lavanda': 'lavanda_jardin', 'arbusto:romero': 'romero_jardin', 'planta-exterior:graminea': 'graminea_jardin',
  'seto:bajo': 'seto_bajo_jardin', 'seto:laurel': 'seto_laurel_jardin', 'seto:fotinia': 'seto_fotinia_jardin',
  pergola: 'pergola_madera_exterior', 'pergola-aluminio': 'pergola_aluminio_exterior', 'pergola-metal': 'pergola_aluminio_exterior',
  carpa: 'carpa_jardin_exterior', toldo: 'toldo_terraza_exterior', sombrilla: 'sombrilla_jardin_exterior',
  barbacoa: 'barbacoa_gas_exterior', 'barbacoa:obra': 'barbacoa_obra_exterior', piscina: 'piscina_elevada_exterior',
  estanque: 'estanque_jardin_exterior', fuente: 'fuente_jardin_exterior', aspersor: 'aspersor_riego_exterior',
  'aspersor:emergente': 'aspersor_emergente_exterior', coche: 'turismo_compacto_exterior',
  'coche:turismo-3d': 'turismo_berlina_exterior', 'coche:suv': 'vehiculo_suv_exterior', 'coche:furgoneta': 'furgoneta_exterior',
  'maceta-exterior': 'maceta_terracota_50', 'jardinera-exterior': 'jardinera_madera_150',
  'jardinera-exterior:terracota': 'jardinera_terracota_100', huerto: 'huerto_240',
  roca: 'roca_110', piedras: 'piedras_100', setas: 'setas_40',
};

export function gardenModelId(item: Pick<Furniture, 'catalogId'> & Partial<Pick<Furniture, 'rolledSides'>>): string | undefined {
  const key = item.catalogId?.replace(/^habiteka:outdoor:/, '');
  if (key === 'carpa' && item.rolledSides && item.rolledSides !== 'none') return `habiteka:model:carpa_${item.rolledSides}_exterior`;
  const model = key && GARDEN_MODELS[key];
  return model ? `habiteka:model:${model}` : undefined;
}
