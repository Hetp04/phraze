// This ensures Chart.js is loaded before it's used
export function ensureChartLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') {
            resolve(Chart);
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/chart.js');
        
        script.onload = () => {
            if (typeof Chart !== 'undefined') {
                resolve(Chart);
            } else {
                reject(new Error('Chart.js loaded but Chart is not defined'));
            }
        };
        
        script.onerror = (error) => {
            console.error('Failed to load Chart.js:', error);
            reject(new Error('Failed to load Chart.js - please check the lib directory'));
        };
        
        document.head.appendChild(script);
    });
} 