document.addEventListener('DOMContentLoaded', () => {
    // Get all modal elements
    const modals = {
        terms: document.getElementById('termsModal'),
        instructions: document.getElementById('instructionsModal'),
        contact: document.getElementById('contactModal')
    };

    // Add click handlers for opening modals
    document.querySelectorAll('.footer-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const modalType = e.target.textContent.toLowerCase();
            if (modals[modalType]) {
                showModal(modals[modalType]);
            }
        });
    });

    // Add click handlers for closing modals
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal-overlay');
            hideModal(modal);
        });
    });

    // Close modal when clicking outside
    Object.values(modals).forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        });
    });
});

function showModal(modal) {
    // First make it display flex but invisible
    modal.classList.add('showing');
    const modalContent = modal.querySelector('.modal-content');
    
    // Force a reflow to enable the transition
    modal.offsetHeight;
    
    // Make the overlay visible
    modal.classList.add('visible');
    
    // Make the content visible
    modalContent.classList.add('visible');
}

function hideModal(modal) {
    const modalContent = modal.querySelector('.modal-content');
    
    // First hide the content
    modalContent.classList.remove('visible');
    
    // Then hide the overlay
    modal.classList.remove('visible');
    
    // Wait for animations to finish before removing display: flex
    setTimeout(() => {
        modal.classList.remove('showing');
    }, 300); // Match this with your CSS transition duration
} 