import { callSetItem, getUserEmail, getCurrentProject } from '../frames.js';
import { isOnWebsite } from '../globalVariables.js';
import { setCurrentProject, getMainCompanyEmail } from './auth.js';

export class ProjectManager {
    constructor() {
        this.initializeListeners();
    }

    async initializeListeners() {
        const projectSelect = document.getElementById('project-select');
        const newProjectBtn = document.getElementById('new-project-btn');

        if (projectSelect) {
            await this.loadProjects();
            projectSelect.addEventListener('change', (e) => this.switchProject(e.target.value));
        }

        console.warn('newProjectBtn1');
        if (newProjectBtn) {
            console.warn('newProjectBtn2');
            newProjectBtn.addEventListener('click', () => this.createNewProject());
        }
    }

    async loadProjects() {
        if(isOnWebsite)
            return;

        const projectSelect = document.getElementById('project-select');
        const userEmail = await getUserEmail();
        var companyEmail = await getMainCompanyEmail();
        // if (!userEmail) return;

        try {
            var projects = {};
            if (userEmail) { //Logged In
                // Get projects using messaging system
                const response = await chrome.runtime.sendMessage({
                    action: "getFirebaseData",
                    path: `Companies/${companyEmail}/projects`
                });

                projects = response.data || {};
            } else {
                // Initialize projects as an object to match Firebase format
                var projects = await chrome.storage.local.get("projects");
                if (projects.projects != undefined)
                    projects = projects.projects;
            }

            // Update select options
            projectSelect.innerHTML = "";
            if(projects && Object.keys(projects).length == 0)
                projects = {"default" : "default"};
            Object.keys(projects).forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                if (project == "default")
                    option.textContent = "Default Project";
                else
                    option.textContent = project;
                projectSelect.appendChild(option);
            });

            // Set current project
            const currentProject = await getCurrentProject();
            projectSelect.value = currentProject;
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    async switchProject(projectName) {
        await setCurrentProject(projectName);
        // Refresh the UI
        window.location.reload();
    }

    async createNewProject() {
        const userEmail = await getUserEmail();
        var companyEmail = await getMainCompanyEmail();
        // if (!userEmail) {
        //     showToast("Please login to create a new project", 'error');
        //     return;
        // }

        const projectName = prompt('Enter new project name:');
        if (!projectName) return;


        callSetItem(
            `Companies/${companyEmail}/projects/${projectName}`,
            {
                created: new Date().toISOString(),
                name: projectName
            }, false
        );

        this.switchProject(projectName);

        // let projectsList = Object.values(callGetItem(`Companies/${companyEmail}/projectNames`, false) || []);
        // if(projectsList.length > 0)
        //     projectsList = projectsList[0];
        // projectsList.append(projectName);
        // callSetItem(
        //     `Companies/${companyEmail}/projectNames`,
        //     projectsList,
        //     false
        // );


        // try {
        //     if (userEmail) { //Logged In
        //         // Save project using messaging system
        //         await chrome.runtime.sendMessage({
        //             action: "saveFirebaseData",
        //             path: `Companies/${companyEmail}/projects/${projectName}`,
        //             data: {
        //                 created: new Date().toISOString(),
        //                 name: projectName
        //             }
        //         });
        //     }
        //     else { //Logged out
        //         var projects = await chrome.storage.local.get("projects");
        //         if (projects.projects != undefined)
        //             projects = projects.projects;

        //         projects[projectName] = { name: projectName };
        //         chrome.storage.local.set({ "projects": projects });
        //     }

        //     await this.loadProjects();
        //     await this.switchProject(projectName);
        // } catch (error) {
        //     console.error('Error creating project:', error);
        // }
    }
}

// Toast notification function
function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast with animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide and remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}