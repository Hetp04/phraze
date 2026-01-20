import { isOnWebsite } from '../globalVariables.js';
import { hideAllSubFrames, showFrame, showFrameLabel, showFrameAndDisplay } from './utils.js';
import { getAnnotationHistory } from '../frames.js';

export class FrequentlyUsedManager {
    constructor() {
        this.labelUsage = new Map();
        this.codeUsage = new Map();
        this.labelTimestamps = new Map();
        this.codeTimestamps = new Map();
    }

    // Record usage of a label (modified to handle custom items)
    recordUsage(type, name, isCustom = false) {
        // Only handle labels, ignore codes
        if (type !== 'label') return;
        
        console.log(`Recording usage of ${isCustom ? 'custom' : 'predefined'} ${type}: ${name}`);
        const usageMap = this.labelUsage;
        const timestampMap = this.labelTimestamps;

        // Create a key that identifies custom items
        const key = isCustom ? `custom:${name}` : name;

        // Update count
        const currentCount = usageMap.get(key) || 0;
        usageMap.set(key, currentCount + 1);
        console.log(`New count for ${key}: ${usageMap.get(key)}`);

        // Update timestamp
        timestampMap.set(key, Date.now());

        // Update display
        this.updateDisplay(type);
    }

    // Get top 3 items (modified to handle custom items)
    getTopItems(type) {
        // Only handle labels, ignore codes
        if (type !== 'label') return [];
        const usageMap = this.labelUsage;
        const timestampMap = this.labelTimestamps;

        return Array.from(usageMap.entries())
            .sort((a, b) => {
                // First sort by count
                if (b[1] !== a[1]) {
                    return b[1] - a[1];
                }
                // If counts are equal, sort by timestamp (most recent first)
                return timestampMap.get(b[0]) - timestampMap.get(a[0]);
            })
            .slice(0, 3)
            .map(([key, count]) => {
                // Remove the custom: prefix for display
                const displayName = key.startsWith('custom:') ? key.substring(7) : key;
                const isCustom = key.startsWith('custom:');
                return {
                    name: displayName,
                    count: count,
                    isCustom: isCustom
                };
            });
    }

    // Update the display (modified to show custom indicator)
    updateDisplay(type) {
        const containerSelector = '.frequently-used-codes .frequently-used-items';
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.warn(`Container not found: ${containerSelector}`);
            return;
        }

        const topItems = this.getTopItems(type);
        console.log(`Top items for ${type}:`, topItems);
        const colors = ['#92c2d7', '#c1b07c', '#b07cc1'];

        container.innerHTML = topItems.map((item, index) => `
            <div class="frequently-used-item" style="opacity: 0; transform: translateY(10px);">
                <div class="frequently-used-item-content">
                    <span class="usage-dot" style="background-color: ${colors[index]};"></span>
                    <div class="item-name-container">
                        <span class="item-name">
                            ${item.name}
                            ${item.isCustom ? '<span class="custom-indicator">(Custom)</span>' : ''}
                        </span>
                        <span class="use-link" data-type="${type}" data-name="${item.name}" data-custom="${item.isCustom}">
                            use
                        </span>
                    </div>
                    <span class="usage-count">${item.count}</span>
                </div>
            </div>
        `).join('');

        // Animate new items and add click handlers
        container.querySelectorAll('.frequently-used-item').forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });

        // Update click handlers to use new class name
        container.querySelectorAll('.use-link').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemType = button.dataset.type;
                const itemName = button.dataset.name;
                const isCustom = button.dataset.custom === 'true';
                this.handleUseButton(itemType, itemName, isCustom);
            });
        });
    }

    // Load saved data
    loadSavedData() {
        let result = new Object();
        result.frequentlyUsed = localStorage.getItem("frequentlyUsed");

        // chrome.storage.sync.get(['frequentlyUsed'], (result) => {
        if (result.frequentlyUsed) {
            const data = JSON.parse(result.frequentlyUsed);
            this.labelUsage = new Map(data.labelUsage);
            this.codeUsage = new Map(data.codeUsage);
            this.labelTimestamps = new Map(data.labelTimestamps);
            this.codeTimestamps = new Map(data.codeTimestamps);
        }
        // Initialize from existing history even if no saved frequency data exists
        this.initializeFromHistory();
        this.updateDisplay('label');
    }

    // Save current data
    saveData() {
        const data = {
            labelUsage: Array.from(this.labelUsage.entries()),
            codeUsage: Array.from(this.codeUsage.entries()),
            labelTimestamps: Array.from(this.labelTimestamps.entries()),
            codeTimestamps: Array.from(this.codeTimestamps.entries())
        };
        // chrome.storage.sync.set({ frequentlyUsed: JSON.stringify(data) });
        localStorage.setItem("frequentlyUsed", JSON.stringify(data));
    }

    // Add this method to FrequentlyUsedManager class
    async initializeFromHistory() {
        let annotationHistory = await getAnnotationHistory();
        annotationHistory = Array.isArray(annotationHistory) ? annotationHistory : [];

        annotationHistory.forEach(annotation => {
            let type = '';
            let key = '';

            annotation.forEach(item => {
                if (item.type) {
                    type = item.type.toLowerCase();
                }
                if (item.key) {
                    key = item.key;
                }
            });

            if (type && key) {
                this.recordUsage(type, key);
            }
        });
    }

    // Add this new method to handle the Use button clicks
    handleUseButton(type, name, isCustom) {
        // Only handle labels, ignore codes
        if (type !== 'label') return;
        
        // Hide all subframes first
        hideAllSubFrames();

        if (isCustom) {
            // For custom labels, show the custom label options
            showFrame("custom-label-sub-frame-1-custom");
            showFrame("custom-label-sub-frame-1-button");

            // Set the key in the custom label interface
            const keyElement = document.getElementById('custom-label-key');
            if (keyElement) {
                keyElement.textContent = name;
            }
        } else {
            // For predefined labels, show the options directly
            showFrameLabel("predefined-label-sub-frame-1-label", name);
            showFrame("predefined-label-sub-frame-1-label-div");

            // Show the specific options display for this label
            const displayId = `${name.toLowerCase()}-display`;
            showFrameAndDisplay(
                "predefined-label-sub-frame-1",
                displayId,
                name,
                "Label",
                window.selectedText || "" // Make sure selectedText is available
            );
            showFrame("predefined-label-sub-frame-1-button");
        }
    }
} 