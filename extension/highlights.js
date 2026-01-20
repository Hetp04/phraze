console.warn('-- highlights.js--')

document.addEventListener('DOMContentLoaded', () => {

    // New code
    const colorOptions = document.querySelectorAll('.color-option');

    console.log('colorOptions', colorOptions);

    // Todo ↘ load saved color preference (might have to mover)
    chrome.storage.sync.get({ highlightColor: 'yellow' }, (data) => {
        const selectedColor = data.highlightColor;
        console.log('selectedColor', selectedColor);
        colorOptions.forEach(option => {
            if (option.dataset.color === selectedColor) {
                option.classList.add('selected');
            }
        });
    });

    // Todo ↘ color selection logic
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            // Save color preference
            chrome.storage.sync.set({ highlightColor: option.dataset.color });

            console.log('option.dataset.color', option.dataset.color);
        });
        console.log('option: ', option);
    });

});