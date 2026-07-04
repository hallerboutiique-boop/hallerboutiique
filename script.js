const slides = Array.from(document.querySelectorAll(".hero-slide"));
let active = 0;

function showSlide(index) {
  if (slides.length === 0) {
    return;
  }
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
}

if (window.lucide) {
  window.lucide.createIcons();
}

if (slides.length > 0) {
  window.setInterval(() => {
    showSlide((active + 1) % slides.length);
  }, 5200);
}

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
