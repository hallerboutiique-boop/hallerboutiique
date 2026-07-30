function stock(sizeType, inventoryBySize) {
  return {
    sizeType,
    sizes: Object.keys(inventoryBySize),
    inventory: Object.values(inventoryBySize).reduce((total, quantity) => total + quantity, 0),
    inventoryBySize,
  };
}

const initialProductStockOverwrite = {
  "balenciaga-track-full-black": stock("sneakers", { 40: 1, 41: 2, 43: 2, 44: 1, 45: 1 }),
  "balenciaga-track-black-pink": stock("sneakers", { 36: 1, 37: 2, 38: 4, 39: 4, 40: 1 }),
  "gucci-high-top-gg-supreme-beige-green-red": stock("sneakers", { 36: 1, 38: 3, 39: 3, 40: 1 }),
  "gucci-ace-green-red": stock("sneakers", { 39: 1, 40: 1, 41: 1, 43: 2, 44: 3, 45: 1 }),
  "alexander-mcqueen-classic-white": stock("sneakers", { 38: 1 }),
  "alexander-mcqueen-sky-blue": stock("sneakers", { 37: 1, 42: 2, 44: 2 }),
  "alexander-mcqueen-grey-white": stock("sneakers", { 36: 2, 37: 2, 38: 4, 39: 3, 40: 2 }),
  "alexander-mcqueen-classic": stock("sneakers", { 36: 1, 37: 1, 38: 2 }),
  "alexander-mcqueen-black-laces": stock("sneakers", { 41: 1, 42: 3 }),
  "custom-adidas-campus-mrzclhnu": stock("sneakers", { 38: 1, 39: 1, 41: 1 }),
  "louis-vuitton-skate-blue": stock("sneakers", { 40: 3, 41: 2, 42: 2, 44: 4, 45: 2 }),
  "louis-vuitton-skate-black-white": stock("sneakers", { 40: 1, 41: 1, 42: 1, 43: 2, 45: 2 }),
  "louis-vuitton-skate-green": stock("sneakers", { 40: 1, 41: 1, 42: 2, 43: 1 }),
  "nike-air-force-louis-vuitton-red": stock("sneakers", { 42: 1, 43: 4, 45: 3 }),
  "jacket-balenciaga": stock("clothing", { S: 1, M: 1, L: 1 }),
  "jacket-stone-island": stock("clothing", { M: 1, L: 1 }),
  "denim-shorts-gucci": stock("jeans", { 40: 1, 42: 1, 44: 2, 50: 1 }),
  "denim-shorts-louis-vuitton": stock("jeans", { 40: 1, 42: 1, 44: 2, 46: 1, 50: 1 }),
  "tracksuit-emporio-armani": stock("clothing", { S: 1, XXL: 1 }),
  "tracksuit-polo-ralph-lauren": stock("clothing", { L: 1, XXL: 1 }),
  "long-denim-dsquared": stock("jeans", { 46: 1, 48: 3, 50: 3, 52: 4, 54: 2 }),
  "denim-shorts-dsquared": stock("jeans", { 42: 1, 44: 1, 46: 3, 48: 1, 52: 1, 54: 1, 56: 2 }),
  "custom-louis-vuitton-trainer-mrzan0ud": stock("sneakers", { 38: 3, 39: 2, 41: 1 }),
  "custom-nike-air-force-ms0glv9y": stock("sneakers", { 44: 1 }),
};

export const productStockOverwriteId = "2026-07-30-apparel-inventory";

export const productStockOverwrite = {
  "custom-tuta-nike-nocta-mrz9w944": stock("clothing", { XS: 2, S: 2, L: 2 }),
  "tracksuit-nike-nocta": stock("clothing", { S: 1, M: 1, L: 1 }),
  "custom-jeans-dsquared-mrzczehr": stock("jeans", { 44: 1, 46: 1, 50: 1 }),
  "custom-jeans-dsquared-mrzc7nvg": stock("jeans", { 50: 1 }),
  "custom-jeans-dsquared-mrzgmoxb": stock("jeans", { 48: 1, 50: 1, 54: 1 }),
  "t-shirt-moncler": stock("clothing", { S: 1, M: 1, XL: 1 }),
  "custom-t-shirt-canada-goose-mrtge42v": stock("clothing", { S: 1, M: 1, XL: 1, XXL: 1 }),
  "t-shirt-off-white-tom-jerry": stock("clothing", { M: 1, L: 1, XL: 1, XXL: 1 }),
  "custom-t-shirt-stone-island-mrzchege": {
    ...stock("clothing", { S: 1, M: 1, L: 1, XL: 1, XXL: 1 }),
    variantGroup: "",
  },
  "t-shirt-stone-island": {
    ...stock("clothing", { M: 1, L: 1, XL: 1, XXL: 1 }),
    variantGroup: "",
  },
  "custom-t-shirt-louis-vuitton-mrzbggz2": stock("clothing", { M: 1, L: 1, XL: 1, XXL: 1 }),
  "custom-t-shirt-louis-vuitton-mrzbsol6": stock("clothing", { M: 1, L: 1, XXL: 1 }),
  "t-shirt-louis-vuitton": stock("clothing", { S: 1, M: 1, L: 1, XL: 1, XXL: 1 }),
  "custom-t-shirt-gucci-mrzceahi": {
    collection: "Catalogo Donna",
    category: "T-Shirts",
    variantGroup: "",
  },
  "t-shirt-gucci": {
    ...stock("clothing", { L: 1, XL: 1, XXL: 1 }),
    variantGroup: "",
  },
  "t-shirt-balenciaga": stock("clothing", { L: 1, XL: 1, XXL: 1 }),
  "custom-t-shirt-off-white-mrzdiyqt": stock("clothing", { S: 1, M: 1, L: 1, XXL: 1 }),
  "t-shirt-givenchy": stock("clothing", { S: 1, L: 1, XL: 1, XXL: 1 }),
};

const productStockOverwrites = [
  { id: "2026-07-30-inventory", products: initialProductStockOverwrite },
  { id: productStockOverwriteId, products: productStockOverwrite },
];

export function applyProductStockOverwrite(data) {
  const appliedIds = Array.isArray(data.appliedStockOverwriteIds) ? [...data.appliedStockOverwriteIds] : [];
  data.items = data.items && typeof data.items === "object" ? data.items : {};
  data.custom = Array.isArray(data.custom) ? data.custom : [];
  const customProducts = new Map(data.custom.map((product) => [product.id, product]));
  let changed = false;

  for (const overwrite of productStockOverwrites) {
    if (appliedIds.includes(overwrite.id)) continue;
    for (const [id, updates] of Object.entries(overwrite.products)) {
      const customProduct = customProducts.get(id);
      if (customProduct) Object.assign(customProduct, updates);
      else data.items[id] = { ...(data.items[id] || {}), ...updates };
    }
    appliedIds.push(overwrite.id);
    changed = true;
  }

  data.appliedStockOverwriteIds = appliedIds;
  return changed;
}
