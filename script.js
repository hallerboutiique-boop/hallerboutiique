const slides = Array.from(document.querySelectorAll(".hero-slide"));
let active = 0;

const clothingSizes = ["S", "M", "L", "XL", "XXL"];
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const cartKey = "hallerBoutiqueCartCount";

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
  const count = Number.parseInt(window.localStorage.getItem(cartKey), 10);
  return Number.isFinite(count) ? count : 0;
}

function updateCartCount(count = readCartCount()) {
  document.querySelectorAll(".cart-button span").forEach((badge) => {
    badge.textContent = String(count);
  });
}

function addToCart(button) {
  const count = readCartCount() + 1;
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
    addToCart();
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
