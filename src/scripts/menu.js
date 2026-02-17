// Hamburger menu toggle
function initMenu() {
  const hamburger = document.getElementById("hamburger-menu");
  const mobileNav = document.getElementById("mobile-nav");

  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", () => {
      mobileNav.classList.toggle("hidden");
    });
  }
}

initMenu();
document.addEventListener("astro:after-swap", initMenu);
