// This script runs before anything else on the page.
// It sets a trap for when 'window.im' is created.

// Guard clause: if this script has already run, do nothing.
if (!window.__project_spotlight_setter_patched) {

    // This variable will hold the real 'im' object once we capture it.
    let imObject = null;

    // Define a custom property on the window named 'im'
    Object.defineProperty(window, 'im', {
        configurable: true, // Allows the page to modify this property later
        
        // This 'get' function runs whenever code tries to access 'window.im'
        get() {
            return imObject;
        },

        // This 'set' function runs the exact moment the page's code tries to
        // assign a value to 'window.im' (e.g., window.im = { ... })
        set(value) {
            // 'value' is the real 'im' object we want to intercept.
            imObject = value;

            // Now that we have the real object, we can safely patch its 'init' function.
            const originalInit = imObject.init;
            
            imObject.init = function(data) {
                // 1. Store the data in sessionStorage for guaranteed retrieval.
                sessionStorage.setItem('__project_spotlight_data', JSON.stringify(data));
                
                // 2. Call the original function so the page loads normally.
                return originalInit.apply(this, arguments);
            };
        }
    });
    
    // Mark that our setter trap has been installed.
    window.__project_spotlight_setter_patched = true;
}