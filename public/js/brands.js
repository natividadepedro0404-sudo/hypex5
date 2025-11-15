// Brands dropdown functionality
document.addEventListener('DOMContentLoaded', () => {
  const brandsDropdown = document.querySelector('.brands-dropdown');
  const brandsDropdownBtn = document.querySelector('.brands-dropdown-btn');
  const brandsLinks = document.querySelectorAll('[data-brand]');

  // Toggle dropdown on click
  if (brandsDropdownBtn) {
    brandsDropdownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      brandsDropdown.classList.toggle('active');
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (brandsDropdown && !brandsDropdown.contains(e.target)) {
      brandsDropdown.classList.remove('active');
    }
  });

  // Handle brand selection
  brandsLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = link.getAttribute('data-brand');
      const brandName = link.textContent.trim();
      
      // Store selected brand in localStorage
      localStorage.setItem('selectedBrand', brand);
      
      // Redirect to category page with brand filter
      // This will filter products by the selected brand
      window.location.href = `/pages/category.html?brand=${brand}`;
    });
  });
  
  // Check if there's a brand in the URL and update the page title
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get('brand');
  if (brandParam) {
    // Find the brand name from the link
    const brandLink = Array.from(brandsLinks).find(link => link.getAttribute('data-brand') === brandParam);
    if (brandLink) {
      const brandName = brandLink.textContent.trim();
      // Update page title if on category page
      const categoryTitle = document.getElementById('category-title');
      if (categoryTitle) {
        categoryTitle.textContent = brandName;
      }
    }
  }
});

