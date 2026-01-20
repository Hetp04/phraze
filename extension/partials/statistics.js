import { callGetItem, callSetItem, sendRuntimeMessage, getCurrentProject } from "../frames.js";
import { getMainCompanyEmail, isUserLoggedIn2 } from "./auth.js";

// Statistics management module
export class StatisticsManager {
    constructor() {
        this.stats = {
            todayAnnotations: 0,
            totalLabels: 0,
            lastAnnotation: null
        };
        this.firebaseListenerActive = false;
        this.currentProject = null;
        this.currentCompanyEmail = null;
        this.initializeEventListeners();
        // Initial load of statistics
        this.initializeStatistics();
    }

    async initializeStatistics() {
        // Check if user is logged in and set up Firebase listener
        const loggedIn = await isUserLoggedIn2();
        if (loggedIn) {
            await this.setupFirebaseListener();
        }
        // Also calculate from history as fallback
        await this.updateStatsFromHistory();
    }

    async setupFirebaseListener() {
        try {
            const companyEmail = await getMainCompanyEmail();
            const projectName = await getCurrentProject();
            
            if (!companyEmail || !projectName) {
                console.warn('Statistics: Missing company email or project name');
                return;
            }

            this.currentCompanyEmail = companyEmail;
            this.currentProject = projectName;

            const statsPath = `Companies/${companyEmail}/projects/${projectName}/statistics`;
            const annotationHistoryPath = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;

            // Set up Firebase real-time listener for statistics
            sendRuntimeMessage({
                action: "listenerFirebaseData",
                path: statsPath
            }, (response) => {
                if (response && response.success) {
                    this.firebaseListenerActive = true;
                    console.log('✅ Statistics: Firebase listener set up for statistics');
                }
            });

            // Also set up listener for annotationHistory changes to recalculate stats
            sendRuntimeMessage({
                action: "listenerFirebaseData",
                path: annotationHistoryPath
            }, (response) => {
                if (response && response.success) {
                    console.log('✅ Statistics: Firebase listener set up for annotationHistory');
                }
            });

            // Listen for Firebase data changes
            if (!this.runtimeMessageListener) {
                this.runtimeMessageListener = (message) => {
                    if (message.action === "firebaseDataChanged") {
                        if (message.path === statsPath && message.data) {
                            this.updateStatsFromFirebase(message.data);
                        } else if (message.path === annotationHistoryPath) {
                            // Annotation history changed, recalculate stats
                            this.updateStatsFromHistory();
                        }
                    }
                };

                // Add listener for runtime messages (works for both extension and website)
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.onMessage.addListener(this.runtimeMessageListener);
                } else if (window.addEventListener) {
                    window.addEventListener('message', (event) => {
                        if (event.data && this.runtimeMessageListener) {
                            this.runtimeMessageListener(event.data);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error setting up Firebase listener for statistics:', error);
        }
    }

    updateStatsFromFirebase(firebaseData) {
        try {
            if (firebaseData) {
                this.updatingFromFirebase = true;
                this.stats = {
                    todayAnnotations: firebaseData.todayAnnotations || 0,
                    totalLabels: firebaseData.totalLabels || 0,
                    lastAnnotation: firebaseData.lastAnnotation ? new Date(firebaseData.lastAnnotation) : null
                };
                this.updateDisplay();
                // Reset flag after a short delay
                setTimeout(() => {
                    this.updatingFromFirebase = false;
                }, 100);
            }
        } catch (error) {
            console.error('Error updating stats from Firebase:', error);
            this.updatingFromFirebase = false;
        }
    }

    async saveStatsToFirebase() {
        try {
            const loggedIn = await isUserLoggedIn2();
            if (!loggedIn) {
                return; // Don't save to Firebase if not logged in
            }

            const companyEmail = this.currentCompanyEmail || await getMainCompanyEmail();
            const projectName = this.currentProject || await getCurrentProject();

            if (!companyEmail || !projectName) {
                return;
            }

            const statsPath = `Companies/${companyEmail}/projects/${projectName}/statistics`;
            const statsData = {
                todayAnnotations: this.stats.todayAnnotations,
                totalLabels: this.stats.totalLabels,
                lastAnnotation: this.stats.lastAnnotation ? this.stats.lastAnnotation.toISOString() : null,
                updatedAt: new Date().toISOString()
            };

            sendRuntimeMessage({
                action: "saveFirebaseData",
                path: statsPath,
                data: statsData
            }, (response) => {
                if (response && response.success) {
                    console.log('✅ Statistics saved to Firebase');
                } else {
                    // Suppress permission denied errors for statistics in shared projects (expected behavior)
                    const isPermissionError = response?.error?.includes('Permission denied') || 
                                            response?.error?.includes('PERMISSION_DENIED');
                    if (!isPermissionError) {
                    console.error('❌ Failed to save statistics to Firebase:', response?.error);
                    }
                    // Permission denied is expected for non-owner members in shared projects
                }
            });
        } catch (error) {
            console.error('Error saving statistics to Firebase:', error);
        }
    }

    initializeEventListeners() {
        // Listen for any annotation updates
        document.addEventListener('annotationUpdated', async () => {
            // Recalculate from history and save to Firebase
            await this.updateStatsFromHistory();
            await this.saveStatsToFirebase();
        });
        
        // Listen for new annotation events with details for immediate update
        document.addEventListener('annotationAdded', async (event) => {
            if (event.detail) {
                this.incrementStats(event.detail);
                await this.saveStatsToFirebase();
            }
        });

        // Listen for user login/logout
        document.addEventListener('userLoggedIn', async (event) => {
            await this.setupFirebaseListener();
            await this.updateStatsFromHistory();
            await this.saveStatsToFirebase();
        });

        document.addEventListener('userLoggedOut', async () => {
            // Remove Firebase listener
            if (this.currentCompanyEmail && this.currentProject) {
                const statsPath = `Companies/${this.currentCompanyEmail}/projects/${this.currentProject}/statistics`;
                sendRuntimeMessage({
                    action: "removeFirebaseListener",
                    path: statsPath
                });
            }
            this.firebaseListenerActive = false;
            await this.updateStatsFromHistory();
        });

        // Listen for project changes
        document.addEventListener('projectChanged', async () => {
            // Remove old listener
            if (this.currentCompanyEmail && this.currentProject) {
                const oldStatsPath = `Companies/${this.currentCompanyEmail}/projects/${this.currentProject}/statistics`;
                sendRuntimeMessage({
                    action: "removeFirebaseListener",
                    path: oldStatsPath
                });
            }
            // Set up new listener
            await this.setupFirebaseListener();
            await this.updateStatsFromHistory();
        });

        // Add storage event listener for cross-tab synchronization (fallback)
        window.addEventListener('storage', (e) => {
            if (e.key === 'annotationHistory') {
                this.updateStatsFromHistory();
            }
        });
    }

    // async migrateGuestData(userEmail) {
    //     try {
    //         // Get all temporary data from localStorage
    //         const tempData = {
    //             annotationHistory: await callGetItem('annotationHistory'),
    //             voiceSavedNotes: await callGetItem('voiceSavedNotes'),
    //             videoSavedNotes: await callGetItem('videoSavedNotes'),
    //             savedNotes: await callGetItem('savedNotes')
    //         };

    //         // If there's any temporary data
    //         if (Object.values(tempData).some(data => data !== null)) {
    //             // Send data to background script to save to Firebase
    //             chrome.runtime.sendMessage({
    //                 action: 'migrateGuestData',
    //                 userEmail: userEmail,
    //                 tempData: tempData
    //             }, (response) => {
    //                 if (response.success) {
    //                     console.log('Guest data migrated successfully');
    //                     // Clear temporary data after successful migration
    //                     Object.keys(tempData).forEach(key => {
    //                         localStorage.removeItem(key);
    //                     });
    //                 } else {
    //                     console.error('Failed to migrate guest data:', response.error);
    //                 }
    //             });
    //         }
    //     } catch (error) {
    //         console.error('Error migrating guest data:', error);
    //     }
    // }

    async updateStatsFromHistory() {
        try {
            let annotationHistory = Object.values(await callGetItem('annotationHistory') || []);
            if(annotationHistory.length > 0)
                annotationHistory = JSON.parse(annotationHistory[0]);

            const history = annotationHistory ? annotationHistory : [];

            const now = new Date();
            const today = now.toDateString();

            let todayCount = 0;
            let totalLabelsCount = 0;
            let lastAnnotationTime = null;

            if (Array.isArray(history)) {
                history.forEach(annotationGroup => {
                    const typeObj = annotationGroup.find(item => item.type);
                    const optionsObj = annotationGroup.find(item => item.options);
                    const timestampObj = annotationGroup.find(item => item.timestamp);

                    if (typeObj && optionsObj) {
                        const annotationType = typeObj.type.toLowerCase();
                        const options = Array.isArray(optionsObj.options) ? optionsObj.options : [optionsObj.options];
                        const timestamp = timestampObj ? new Date(timestampObj.timestamp) : new Date();

                        // Count today's annotations
                        if (timestamp.toDateString() === today) {
                            todayCount += options.length;
                        }

                        // Count by type
                        if (annotationType === 'label') {
                            totalLabelsCount += options.length;
                        }

                        // Track last annotation time
                        if (!lastAnnotationTime || timestamp > lastAnnotationTime) {
                            lastAnnotationTime = timestamp;
                        }
                    }
                });
            }

            this.stats = {
                todayAnnotations: todayCount,
                totalLabels: totalLabelsCount,
                lastAnnotation: lastAnnotationTime
            };

            this.updateDisplay();
            
            // Save to Firebase if logged in (but don't save if we just got this from Firebase to avoid loops)
            // We'll only save if this update came from recalculating from history, not from Firebase listener
            if (!this.updatingFromFirebase) {
                this.saveStatsToFirebase();
            }
        } catch (error) {
            console.error('Error updating statistics:', error);
            this.resetStats();
        }
    }

    // Incrementally update stats immediately when a new annotation is added
    incrementStats(annotationData) {
        const { type, timestamp } = annotationData;
        const now = new Date();
        const today = now.toDateString();
        const annotationTime = timestamp ? new Date(timestamp) : now;
        
        // Check if annotation is from today
        if (annotationTime.toDateString() === today) {
            this.stats.todayAnnotations += 1;
        }
        
        // Increment type-specific count
        if (type && type.toLowerCase() === 'label') {
            this.stats.totalLabels += 1;
        }
        
        // Update last annotation time if this is more recent
        if (!this.stats.lastAnnotation || annotationTime > this.stats.lastAnnotation) {
            this.stats.lastAnnotation = annotationTime;
        }
        
        // Update display immediately
        this.updateDisplay();
    }

    formatTimeSince(date) {
        if (!date) return 'Never';

        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    updateDisplay() {
        const elements = {
            'today-annotations': this.stats.todayAnnotations,
            'total-labels': this.stats.totalLabels,
            'last-annotation': this.formatTimeSince(this.stats.lastAnnotation)
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    resetStats() {
        this.stats = {
            todayAnnotations: 0,
            totalLabels: 0,
            lastAnnotation: null
        };
        this.updateDisplay();
    }
}

// Create and export a single instance
export const statisticsManager = new StatisticsManager(); 