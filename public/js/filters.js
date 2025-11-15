// Função para inicializar os dropdowns dos filtros
function initFilterDropdowns() {
    // Adicionar event listeners para todos os botões de dropdown
    const dropdownBtns = document.querySelectorAll('.dropdown-btn');
    
    dropdownBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdown = this.closest('.dropdown');
            const isActive = dropdown.classList.contains('active');
            
            // Fechar todos os dropdowns
            closeAllDropdowns();
            
            // Abrir o dropdown clicado se não estava ativo
            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
    });
    
    // Fechar dropdowns quando clicar fora
    document.addEventListener('click', function(e) {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        if (activeDropdowns.length > 0 && !e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // Atualizar texto do botão quando checkboxes forem marcados/desmarcados
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
        const btn = dropdown.querySelector('.dropdown-btn');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                updateDropdownButtonText(dropdown);
            });
        });
        
        // Inicializar texto do botão
        updateDropdownButtonText(dropdown);
    });
}

// Função para fechar todos os dropdowns
function closeAllDropdowns() {
    const activeDropdowns = document.querySelectorAll('.dropdown.active');
    activeDropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
    });
}

// Função para atualizar o texto do botão do dropdown
function updateDropdownButtonText(dropdown) {
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
    const btn = dropdown.querySelector('.dropdown-btn');
    const filterType = dropdown.closest('.filter-group').querySelector('h4').textContent.toLowerCase();
    
    const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
    
    if (checkedBoxes.length === 0) {
        btn.innerHTML = `Selecione ${filterType} <i class="fas fa-chevron-down"></i>`;
    } else if (checkedBoxes.length === 1) {
        const label = checkedBoxes[0].closest('label').textContent.trim();
        btn.innerHTML = `${label} <i class="fas fa-chevron-down"></i>`;
    } else {
        btn.innerHTML = `${checkedBoxes.length} ${filterType} selecionados <i class="fas fa-chevron-down"></i>`;
    }
}

// Inicializar os dropdowns quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Pequeno atraso para garantir que todo o conteúdo esteja carregado
    setTimeout(initFilterDropdowns, 100);
});