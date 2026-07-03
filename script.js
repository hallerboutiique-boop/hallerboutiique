const slides = Array.from(document.querySelectorAll(".hero-slide"));
let active = 0;

function showSlide(index) {
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
}

if (window.lucide) {
  window.lucide.createIcons();
}

window.setInterval(() => {
  showSlide((active + 1) % slides.length);
}, 5200);
