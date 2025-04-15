/**
 * Utility script to load the docx library reliably
 */
(function() {
    function loadDocx() {
        return new Promise((resolve, reject) => {
            // First, check if docx is already loaded
            if (typeof docx !== 'undefined') {
                console.log('docx already available');
                return resolve(docx);
            }
            
            // Try to load from main CDN
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/docx@8.2.3/build/index.js';
            script.async = true;
            
            script.onload = function() {
                console.log('docx loaded successfully');
                if (typeof docx !== 'undefined') {
                    resolve(docx);
                } else {
                    reject(new Error('docx loaded but not defined in global scope'));
                }
            };
            
            script.onerror = function() {
                // Try alternate CDN
                console.warn('Primary CDN failed, trying alternate source');
                const altScript = document.createElement('script');
                altScript.src = 'https://cdn.jsdelivr.net/npm/docx@8.2.3/build/index.js';
                altScript.async = true;
                
                altScript.onload = function() {
                    console.log('docx loaded from alternate CDN');
                    if (typeof docx !== 'undefined') {
                        resolve(docx);
                    } else {
                        reject(new Error('docx loaded from alternate CDN but not defined in global scope'));
                    }
                };
                
                altScript.onerror = function() {
                    // Try local fallback
                    console.warn('Alternate CDN failed, trying local fallback');
                    const localScript = document.createElement('script');
                    localScript.src = '/js/libs/docx.js';
                    localScript.async = true;
                    
                    localScript.onload = function() {
                        console.log('docx loaded from local fallback');
                        if (typeof docx !== 'undefined') {
                            resolve(docx);
                        } else {
                            reject(new Error('docx loaded from local fallback but not defined in global scope'));
                        }
                    };
                    
                    localScript.onerror = function() {
                        reject(new Error('Failed to load docx from all sources'));
                    };
                    
                    document.head.appendChild(localScript);
                };
                
                document.head.appendChild(altScript);
            };
            
            document.head.appendChild(script);
        });
    }
    
    // Export the loader function
    window.loadDocxLibrary = loadDocx;
})(); 