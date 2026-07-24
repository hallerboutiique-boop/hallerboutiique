import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustProductInventory,
  availableInventorySizes,
  defaultProductSizes,
  inventoryBySizeTotal,
  isBagProduct,
  normalizeInventoryBySize,
  productInventoryTotal,
  resolveProductSizeType,
} from "./product-inventory.mjs";

test("normalizes inventory for configured product sizes", () => {
  assert.deepEqual(
    normalizeInventoryBySize({ s: 2, M: "1", XL: -1, OTHER: 4 }, ["S", "M", "L", "XL"]),
    { S: 2, M: 1 }
  );
});

test("keeps the complete configured European shoe range", () => {
  const europeanShoes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
  assert.deepEqual(
    normalizeInventoryBySize({ 35: 1, 36: 2, 39: "3", 45: 4, 46: 5 }, europeanShoes),
    { 36: 2, 39: 3, 45: 4 }
  );
});

test("uses European sizes for footwear and clothing sizes for apparel", () => {
  assert.equal(resolveProductSizeType({ collection: "Catalogo Donna", category: "Scarpe", sizeType: "none" }), "sneakers");
  assert.equal(resolveProductSizeType({ collection: "Scarpe Uomo", category: "Nuovi arrivi", sizeType: "clothing" }), "sneakers");
  assert.equal(resolveProductSizeType({ collection: "Catalogo Uomo", category: "T-Shirts", sizeType: "none" }), "clothing");
  assert.equal(resolveProductSizeType({ collection: "Catalogo Donna", category: "Borse Donna", sizeType: "clothing" }), "none");
  assert.equal(resolveProductSizeType({ name: "Mini Bag Hermès", collection: "Nuovi arrivi", category: "Novità", sizeType: "clothing" }), "none");
  assert.deepEqual(defaultProductSizes.clothing, ["S", "M", "L", "XL", "XXL"]);
});

test("uses the complete European 40-56 range for jeans and denim", () => {
  const jeansSizes = ["40", "42", "44", "46", "48", "50", "52", "54", "56"];
  assert.equal(resolveProductSizeType({ name: "Jeans Dsquared", sizeType: "clothing" }), "jeans");
  assert.equal(resolveProductSizeType({ category: "Denim Uomo", sizeType: "clothing" }), "jeans");
  assert.equal(resolveProductSizeType({ name: "Pantalone Uomo", sizeType: "jeans" }), "jeans");
  assert.deepEqual(defaultProductSizes.jeans, jeansSizes);
  assert.deepEqual(
    normalizeInventoryBySize({ 38: 1, 40: 2, 48: 3, 56: 1, 58: 4 }, jeansSizes),
    { 40: 2, 48: 3, 56: 1 }
  );
});

test("recognizes bags independently from their catalog category", () => {
  assert.equal(isBagProduct({ name: "BORSA PRADA", category: "Nuovi arrivi" }), true);
  assert.equal(isBagProduct({ name: "Flap Bag Chanel", category: "Novità" }), true);
  assert.equal(isBagProduct({ name: "Backpack Louis Vuitton", category: "Donna" }), true);
  assert.equal(isBagProduct({ name: "T-Shirt Gucci", category: "T-Shirts Uomo" }), false);
});

test("calculates total and available sizes from size inventory", () => {
  const product = { inventory: 99, inventoryBySize: { S: 0, M: 2, L: 1 } };
  assert.equal(inventoryBySizeTotal(product.inventoryBySize), 3);
  assert.equal(productInventoryTotal(product), 3);
  assert.deepEqual(availableInventorySizes(product), ["M", "L"]);
});

test("decrements and restores only the ordered size", () => {
  const product = { inventoryBySize: { S: 2, M: 1, L: 0 }, inventory: 3 };
  assert.equal(adjustProductInventory(product, { size: "M", quantity: 1 }, -1), true);
  assert.deepEqual(product.inventoryBySize, { S: 2, M: 0, L: 0 });
  assert.equal(product.inventory, 2);
  assert.equal(adjustProductInventory(product, { size: "M", quantity: 1 }, 1), true);
  assert.deepEqual(product.inventoryBySize, { S: 2, M: 1, L: 0 });
  assert.equal(product.inventory, 3);
});

test("keeps total inventory behavior for products without sizes", () => {
  const product = { inventory: 2 };
  assert.equal(adjustProductInventory(product, { quantity: 1 }, -1), true);
  assert.equal(product.inventory, 1);
  assert.equal(productInventoryTotal(product), 1);
});

test("rejects a size or quantity that is not available", () => {
  const product = { inventoryBySize: { S: 1, M: 0 }, inventory: 1 };
  assert.equal(adjustProductInventory(product, { size: "M", quantity: 1 }, -1), false);
  assert.equal(adjustProductInventory(product, { size: "S", quantity: 2 }, -1), false);
  assert.equal(adjustProductInventory(product, { size: "XL", quantity: 1 }, -1), false);
  assert.deepEqual(product.inventoryBySize, { S: 1, M: 0 });
  assert.equal(product.inventory, 1);
});
