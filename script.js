const slides = Array.from(document.querySelectorAll(".slide"));
const dots = Array.from(document.querySelectorAll(".dot"));
let activeSlide = 0;
let timer;

function showSlide(index) {
  activeSlide = index;
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === index);
  });
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === index);
  });
}

function startSlider() {
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    showSlide((activeSlide + 1) % slides.length);
  }, 5200);
}

dots.forEach((dot, index) => {
  dot.addEventListener("click", () => {
    showSlide(index);
    startSlider();
  });
});

if (window.lucide) {
  window.lucide.createIcons();
}

startSlider();
