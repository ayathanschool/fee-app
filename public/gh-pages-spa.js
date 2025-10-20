// Simple SPA routing helper for GitHub Pages
(function() {
  // Basic pathname handling for SPA on GitHub Pages
  const basePath = '/fee-app/';
  
  // Only redirect if this is a path-based route (not the root or already using hash)
  if (window.location.pathname.startsWith(basePath) && 
      window.location.pathname.length > basePath.length && 
      !window.location.hash) {
    
    // Convert the path to a hash route
    const route = window.location.pathname.substring(basePath.length);
    
    // Redirect to the hash-based route equivalent
    window.location.replace(basePath + '#/' + route);
  }
})();