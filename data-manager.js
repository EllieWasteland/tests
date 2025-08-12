// Este archivo centraliza toda la lógica de almacenamiento.

const UNIFIED_STORAGE_KEY = 'mySoul-data-v1';

// Exportamos las funciones para que otros archivos puedan importarlas.
export function getDefaultUnifiedState() {
    return {
        myTime: { 
            userName: null, 
            tasks: [], 
            schedule: [], 
            currentView: 'dashboard', 
            selectedTaskId: null, 
            selectedSubjectId: null, 
            tempSubtasks: [], 
            calendarDate: new Date().toISOString(), 
            wallpaper: null, 
            filters: { priority: 'all', tag: 'all' }, 
            zenSettings: { pomodoro: 25, shortBreak: 5, longBreak: 15, color: '#00F0FF' }, 
            gamification: { streak: 0, lastCompletionDate: null, achievements: [], pomodoroCount: 0 }, 
            currentZenTaskId: null 
        },
        myMemory: { 
            memories: [], 
            settings: { theme: 'dark' } 
        },
        myRoute: {
            routes: [],
            settings: {
                mapStyle: 'dark'
            }
        },
        myMood: { // Nueva sección para MyMood
            entries: []
        },
        globalSettings: { onboardingComplete: false }
    };
}

export function getUnifiedData() {
    const data = localStorage.getItem(UNIFIED_STORAGE_KEY);
    if (data) {
        try {
            const parsedData = JSON.parse(data);
            const defaultState = getDefaultUnifiedState();
            // Fusiona los datos guardados con el estado por defecto para asegurar que todas las claves existan
            return {
                ...defaultState,
                ...parsedData,
                myTime: { ...defaultState.myTime, ...(parsedData.myTime || {}) },
                myMemory: { ...defaultState.myMemory, ...(parsedData.myMemory || {}) },
                myRoute: { ...defaultState.myRoute, ...(parsedData.myRoute || {}) },
                myMood: { ...defaultState.myMood, ...(parsedData.myMood || {}) }, // Fusionar MyMood
                globalSettings: { ...defaultState.globalSettings, ...(parsedData.globalSettings || {}) },
            };
        } catch (error) {
            console.error("Error al parsear datos unificados, se retorna al estado por defecto:", error);
            return getDefaultUnifiedState();
        }
    }
    return getDefaultUnifiedState();
}

export function saveUnifiedData(data) {
    try {
        localStorage.setItem(UNIFIED_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Error al guardar los datos unificados:", error);
    }
}
