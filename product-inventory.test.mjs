import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustProductInventory,
  availableInventorySizes,
  inventoryBySizeTotal,
  normalizeInventoryBySize,
  productInventoryTotal,
} from "./product-inventory.mjs";

test("normalizes inventory for configured product sizes", () => {
  assert.deepEqual(
    normalizeInventoryBySize({ s: 2, M: "1", XL: -1, OTHER: 4 }, ["S", "M", "L", "XL"]),
    { S: 2, M: 1 }
  );
});

test("keeps the complete configured European shoe range", () => {
  const europeanShoes = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
  assert.deepEqual(
    normalizeInventoryBySize({ 34: 1, 39: 2, 48: "3", 49: 4 }, europeanShoes),
    { 34: 1, 39: 2, 48: 3 }
  );
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
