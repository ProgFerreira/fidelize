/** Preço efetivo: override do profissional ou preço do catálogo. */
export function resolveServicePrice(
  catalogPrice: number,
  professionalPrice?: number | null,
): number {
  if (professionalPrice == null || Number.isNaN(Number(professionalPrice))) {
    return Number(catalogPrice) || 0;
  }
  return Number(professionalPrice);
}
