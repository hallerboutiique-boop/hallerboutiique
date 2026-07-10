const slides = Array.from(document.querySelectorAll(".hero-slide"));
let active = 0;

const clothingSizes = ["S", "M", "L", "XL", "XXL"];
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const cartKey = "hallerBoutiqueCartCount";
const cartItemsKey = "hallerBoutiqueCartItems";
const checkoutItemKey = "hallerBoutiqueCheckoutItem";
const orderCodeKey = "hallerBoutiqueOrderCode";

const cryptoWallets = {
  btc: {
    title: "BTC",
    network: "Bitcoin",
    address: "bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm",
    qrData: (orderCode) =>
      `bitcoin:bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm?message=${encodeURIComponent(orderCode)}`,
  },
  usdc: {
    title: "USDC",
    network: "Base",
    address: "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
    qrData: () => "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
  },
  usdt: {
    title: "USDT",
    network: "TRON",
    address: "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
    qrData: () => "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
  },
  sol: {
    title: "SOL",
    network: "SOL",
    address: "9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz",
    qrData: (orderCode) =>
      `solana:9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz?label=${encodeURIComponent("Haller Boutique")}&message=${encodeURIComponent(orderCode)}&memo=${encodeURIComponent(orderCode)}`,
  },
};

const euro = (value) => `${value}\u20ac`;

function item(name, original, finalPrice, discount, sizeType) {
  return {
    name,
    original: euro(original),
    finalPrice: euro(finalPrice),
    discount,
    sizeType,
  };
}

function bulk(names, original, finalPrice, discount, sizeType) {
  return names.map((name) => item(name, original, finalPrice, discount, sizeType));
}

const catalogSections = [
  {
    id: "uomo",
    title: "Catalogo Uomo",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          [
            "T-Shirt Balenciaga",
            "T-Shirt Stone Island",
            "T-Shirt Givenchy",
            "T-Shirt Moncler",
            "T-Shirt Gucci",
            "T-Shirt Louis Vuitton",
            "T-Shirt Off-White Tom & Jerry",
          ],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Polo",
        discount: "-40%",
        products: [item("Polo Gucci", "133,32", "79,99", "-40%", "clothing")],
      },
      {
        name: "Tracksuits",
        discount: "-45%",
        products: [
          item("Tracksuit Nike Nocta", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Polo Ralph Lauren", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Emporio Armani", "218,16", "119,99", "-45%", "clothing"),
        ],
      },
      {
        name: "Two-Piece Sets",
        discount: "-30%",
        products: bulk(
          ["Two-Piece Set Moschino", "Two-Piece Set Gucci"],
          "142,84",
          "99,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Jackets",
        discount: "-30%",
        products: bulk(
          ["Jacket Stone Island", "Jacket Balenciaga"],
          "128,56",
          "89,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Long Denim",
        discount: "-30%",
        products: [item("Long Denim Dsquared", "114,27", "79,99", "-30%", "clothing")],
      },
      {
        name: "Denim Shorts",
        discount: "-30%",
        products: bulk(
          ["Denim Shorts Louis Vuitton", "Denim Shorts Gucci", "Denim Shorts Dsquared"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Shorts",
        discount: "-30%",
        products: [item("EA7 Red Shorts", "85,70", "59,99", "-30%", "clothing")],
      },
      {
        name: "Borse Uomo",
        discount: "-30%",
        products: [
          item("Crossbody Bag Gucci", "171,41", "119,99", "-30%", "none"),
          item("Crossbody Bag Louis Vuitton", "185,70", "129,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
          item("Card Holder Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
        ],
      },
      {
        name: "Sneakers Uomo",
        discount: "-45%",
        products: [
          item("Air Jordan", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Shox Full Black", "163,62", "89,99", "-45%", "sneakers"),
          item("Nike TN Full Black", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike TN Full White", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike Air Force Panda", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Black/White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Full White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Louis Vuitton Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Nike Air Force Chunky Laces", "254,53", "139,99", "-45%", "sneakers"),
          item("Gucci Ace Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Black", "272,71", "149,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Brown", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Beige/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/Grey", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Green", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Blue", "290,89", "159,99", "-45%", "sneakers"),
          item("Balenciaga Track Full Black", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Black Laces", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
    ],
  },
  {
    id: "donna",
    title: "Catalogo Donna",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          ["T-Shirt Louis Vuitton", "T-Shirt Palm Angels"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Borse Donna",
        discount: "-30%",
        products: [
          item("Bag Louis Vuitton", "357,13", "249,99", "-30%", "none"),
          item("Backpack Louis Vuitton", "471,41", "329,99", "-30%", "none"),
          item("Mini Bag Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
          item("Flap Bag Chanel", "214,27", "149,99", "-30%", "none"),
          item("Baguette Bag Fendi", "199,99", "139,99", "-30%", "none"),
          item("Kelly Bag Herm\u00e8s", "271,41", "189,99", "-30%", "none"),
          item("Wallet Bag Herm\u00e8s", "199,99", "139,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
        ],
      },
      {
        name: "Sneakers Donna",
        discount: "-45%",
        products: [
          item("Nike Air Force White/Pink", "181,80", "99,99", "-45%", "sneakers"),
          item("Gucci High Top GG Supreme Beige/Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Pink", "272,71", "149,99", "-45%", "sneakers"),
          item("Balenciaga Track Black/Pink", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
    ],
  },
];

function showSlide(index) {
  if (slides.length === 0) {
    return;
  }
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
}

function getSizes(sizeType) {
  if (sizeType === "clothing") {
    return clothingSizes;
  }
  if (sizeType === "sneakers") {
    return sneakerSizes;
  }
  return [];
}

function createSizesMarkup(product) {
  const sizes = getSizes(product.sizeType);

  if (sizes.length === 0) {
    return "";
  }

  return `
    <div class="product-sizes" aria-label="Taglie disponibili">
      <span>Taglie</span>
      <div>${sizes.map((size) => `<button type="button">${size}</button>`).join("")}</div>
    </div>
  `;
}

function createProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-media">
        <span class="discount-badge">${product.discount}</span>
        <div class="image-placeholder">
          <span>Placeholder immagine</span>
        </div>
      </div>
      <div class="product-body">
        <h4>${product.name}</h4>
        <div class="product-prices" aria-label="Prezzo">
          <span class="price-original">${product.original}</span>
          <strong>${product.finalPrice}</strong>
        </div>
        ${createSizesMarkup(product)}
        <div class="product-actions">
          <button type="button" data-add-to-cart="${product.name}">Aggiungi al carrello</button>
          <button type="button" data-buy-now="${product.name}">Acquista ora</button>
        </div>
      </div>
    </article>
  `;
}

function getAllProducts() {
  return catalogSections.flatMap((section) =>
    section.categories.flatMap((category) => category.products)
  );
}

function findProduct(productName) {
  return getAllProducts().find((product) => product.name === productName);
}

function saveCheckoutItem(productName) {
  const product = findProduct(productName);

  if (!product) {
    return null;
  }

  const item = {
    name: product.name,
    price: product.finalPrice,
    original: product.original,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(checkoutItemKey, JSON.stringify(item));
  return item;
}

function renderCatalog() {
  const catalogRoot = document.querySelector("[data-catalog]");

  if (!catalogRoot) {
    return;
  }

  catalogRoot.innerHTML = catalogSections
    .map(
      (section) => `
        <section class="catalog-gender" id="${section.id}">
          <header class="catalog-gender-heading">
            <p>Haller Boutique</p>
            <h2>${section.title}</h2>
          </header>
          <div class="catalog-categories">
            ${section.categories
              .map(
                (category) => `
                  <section class="catalog-category">
                    <header class="catalog-category-heading">
                      <h3>${category.name}</h3>
                      <span>${category.discount}</span>
                    </header>
                    <div class="product-grid">
                      ${category.products.map(createProductCard).join("")}
                    </div>
                  </section>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function readCartCount() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) {
    return cartItems.length;
  }

  const count = Number.parseInt(window.localStorage.getItem(cartKey), 10);
  return Number.isFinite(count) ? count : 0;
}

function readCartItems() {
  try {
    const items = JSON.parse(window.localStorage.getItem(cartItemsKey));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function addCheckoutItem(productName) {
  const item = saveCheckoutItem(productName);

  if (!item) {
    return readCartItems();
  }

  const cartItems = readCartItems();
  cartItems.push(item);
  window.localStorage.setItem(cartItemsKey, JSON.stringify(cartItems));

  return cartItems;
}

function updateCartCount(count = readCartCount()) {
  document.querySelectorAll(".cart-button span").forEach((badge) => {
    badge.textContent = String(count);
  });
}

function addToCart(button) {
  const productName = button ? button.dataset.addToCart || button.dataset.buyNow : "";
  const cartItems = productName ? addCheckoutItem(productName) : [];
  const count = cartItems.length > 0 ? cartItems.length : readCartCount() + 1;
  window.localStorage.setItem(cartKey, String(count));
  updateCartCount(count);

  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Aggiunto";
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function createOrderCode() {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(3)))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      : Math.random().toString(16).slice(2, 8).toUpperCase();

  return `HB-${date}-${random}`;
}

function readOrderCode() {
  let orderCode = window.localStorage.getItem(orderCodeKey);

  if (!orderCode) {
    orderCode = createOrderCode();
    window.localStorage.setItem(orderCodeKey, orderCode);
  }

  return orderCode;
}

function readCheckoutItem() {
  try {
    return JSON.parse(window.localStorage.getItem(checkoutItemKey));
  } catch {
    return null;
  }
}

function getCheckoutProductText() {
  const cartItems = readCartItems();

  if (cartItems.length > 0) {
    return cartItems.map((item) => `${item.name} - ${item.price}`).join("; ");
  }

  const item = readCheckoutItem();

  if (!item || !item.name) {
    return "Da confermare";
  }

  return item.price ? `${item.name} - ${item.price}` : item.name;
}

function getFieldValue(name) {
  const field = document.querySelector(`[name="${name}"]`);
  return field && field.value.trim() ? field.value.trim() : "Da compilare";
}

function copyText(text, button) {
  if (!text) {
    return;
  }

  const setCopied = () => {
    if (!button) {
      return;
    }
    const label = button.querySelector("span") || button;
    const originalText = label.textContent;
    label.textContent = "Copiato";
    window.setTimeout(() => {
      label.textContent = originalText;
    }, 1200);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(setCopied).catch(() => {});
    return;
  }

  window.prompt("Copia questo testo", text);
  setCopied();
}

function buildPaymentPacket(orderCode, wallet) {
  return [
    `Codice ordine: ${orderCode}`,
    `Prodotto: ${getCheckoutProductText()}`,
    `Cliente: ${getFieldValue("name")}`,
    `Telefono: ${getFieldValue("phone")}`,
    `Email: ${getFieldValue("email")}`,
    `Pagamento: ${wallet.title} (${wallet.network})`,
    `Wallet: ${wallet.address || wallet.displayAddress}`,
    `TX hash: ${getFieldValue("tx-hash")}`,
  ].join("\n");
}

function setupCheckoutPayments() {
  const cryptoPanel = document.querySelector(".crypto-payment");
  const codPanel = document.querySelector(".cod-only");
  const paymentInputs = Array.from(document.querySelectorAll('input[name="payment-method"]'));
  const paymentOptions = Array.from(document.querySelectorAll(".payment-option"));
  const paymentSummary = document.querySelector("[data-payment-method-summary]");
  const checkoutNote = document.querySelector("[data-checkout-note]");
  const orderCode = readOrderCode();
  const orderProduct = document.querySelector("[data-order-product]");
  const qrImage = document.querySelector("[data-crypto-qr]");
  const walletCard = document.querySelector(".crypto-wallet-card");
  const cryptoTitle = document.querySelector("[data-crypto-title]");
  const cryptoNetwork = document.querySelector("[data-crypto-network]");
  const cryptoAddress = document.querySelector("[data-crypto-address]");
  const cryptoWarning = document.querySelector("[data-crypto-warning]");
  const paymentPacket = document.querySelector("[data-payment-packet]");
  const cryptoButtons = Array.from(document.querySelectorAll("[data-crypto-option]"));
  const copyWalletButton = document.querySelector("[data-copy-wallet]");
  let selectedCrypto = "btc";

  if (paymentInputs.length === 0 && !cryptoPanel) {
    return;
  }

  if (orderProduct) {
    orderProduct.textContent = getCheckoutProductText();
  }

  document.querySelectorAll("[data-order-code]").forEach((element) => {
    element.textContent = orderCode;
  });

  function updatePaymentPacket() {
    const wallet = cryptoWallets[selectedCrypto];
    if (paymentPacket && wallet) {
      paymentPacket.value = buildPaymentPacket(orderCode, wallet);
    }
  }

  function setCryptoOption(option) {
    const wallet = cryptoWallets[option] || cryptoWallets.btc;
    selectedCrypto = option in cryptoWallets ? option : "btc";

    cryptoButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cryptoOption === selectedCrypto);
    });

    if (cryptoTitle) {
      cryptoTitle.textContent = wallet.title;
    }
    if (cryptoNetwork) {
      cryptoNetwork.textContent = wallet.network;
    }
    if (cryptoAddress) {
      cryptoAddress.textContent = wallet.address || wallet.displayAddress;
    }
    if (qrImage) {
      if (wallet.address && wallet.qrData) {
        const qrData = wallet.qrData(orderCode);
        qrImage.hidden = false;
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(qrData)}`;
      } else {
        qrImage.hidden = true;
        qrImage.removeAttribute("src");
      }
    }
    if (walletCard) {
      walletCard.classList.toggle("is-missing-wallet", !wallet.address);
    }
    if (cryptoWarning) {
      cryptoWarning.hidden = !wallet.warning;
      cryptoWarning.textContent = wallet.warning || "";
    }
    if (copyWalletButton) {
      copyWalletButton.disabled = !wallet.address;
      const label = copyWalletButton.querySelector("span");
      if (label) {
        label.textContent = wallet.address ? "Copia indirizzo" : "Wallet mancante";
      }
    }

    updatePaymentPacket();
  }

  function setPaymentMethod(method) {
    const isCrypto = method === "crypto";

    paymentInputs.forEach((input) => {
      input.checked = input.value === method;
    });

    paymentOptions.forEach((option) => {
      const input = option.querySelector("input");
      option.classList.toggle("is-active", Boolean(input && input.value === method));
    });

    if (cryptoPanel) {
      cryptoPanel.hidden = !isCrypto;
    }
    if (codPanel) {
      codPanel.hidden = isCrypto;
    }
    if (paymentSummary) {
      paymentSummary.textContent = isCrypto ? `Crypto ${cryptoWallets[selectedCrypto].title}` : "Contrassegno";
    }
    if (checkoutNote) {
      checkoutNote.textContent = isCrypto
        ? "Invia pagamento crypto e poi manda TX hash con codice ordine."
        : "Nessun pagamento online richiesto in questa fase.";
    }

    updatePaymentPacket();
  }

  paymentInputs.forEach((input) => {
    input.addEventListener("change", () => setPaymentMethod(input.value));
  });

  cryptoButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCryptoOption(button.dataset.cryptoOption);
      setPaymentMethod("crypto");
    });
  });

  document.querySelectorAll(".checkout-form input").forEach((input) => {
    input.addEventListener("input", updatePaymentPacket);
  });

  const copyOrderButton = document.querySelector("[data-copy-order-code]");
  if (copyOrderButton) {
    copyOrderButton.addEventListener("click", () => copyText(orderCode, copyOrderButton));
  }

  if (copyWalletButton) {
    copyWalletButton.addEventListener("click", () => {
      const wallet = cryptoWallets[selectedCrypto];
      if (!wallet.address) {
        return;
      }

      copyText(wallet.address, copyWalletButton);
    });
  }

  const copyPacketButton = document.querySelector("[data-copy-payment-packet]");
  if (copyPacketButton) {
    copyPacketButton.addEventListener("click", () => {
      copyText(paymentPacket ? paymentPacket.value : "", copyPacketButton);
    });
  }

  setCryptoOption(selectedCrypto);
  setPaymentMethod(paymentInputs.find((input) => input.checked)?.value || "cod");
}

renderCatalog();
updateCartCount();

if (window.lucide) {
  window.lucide.createIcons();
}

if (slides.length > 0) {
  window.setInterval(() => {
    showSlide((active + 1) % slides.length);
  }, 5200);
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-to-cart]");
  const buyButton = event.target.closest("[data-buy-now]");

  if (addButton) {
    addToCart(addButton);
  }

  if (buyButton) {
    addToCart(buyButton);
    window.location.href = "checkout.html";
  }
});

const discountButton = document.querySelector("[data-discount-apply]");
const discountInput = document.querySelector("input[name='discount-code']");
const discountMessage = document.querySelector(".discount-message");

if (discountButton && discountInput && discountMessage) {
  discountButton.addEventListener("click", () => {
    const code = discountInput.value.trim();

    discountMessage.textContent = code
      ? "Codice sconto inserito. Lo verificheremo alla conferma dell'ordine."
      : "Inserisci un codice sconto prima di applicarlo.";
  });
}

setupCheckoutPayments();
