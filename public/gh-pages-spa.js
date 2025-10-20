// This script helps with SPA routing on GitHub Pages
(function() {
  // Get the base URL path
  const baseUrl = '/fee-app/'; // Must match repo name in vite.config.js base path
  
  // If we have a hash route but no hash in the URL, extract from the path
  if (window.location.pathname.startsWith(baseUrl) && 
      window.location.pathname.length > baseUrl.length &&
      !window.location.hash) {
    // Extract the path after the base URL to use as route
    const route = window.location.pathname.substring(baseUrl.length);
    window.location.replace(baseUrl + '#/' + route);
  }
})();