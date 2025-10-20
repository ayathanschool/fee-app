# Fee Collection Proxy

A React application for fee collection management with Google Sheets backend.

## Deployment on GitHub Pages

This project is configured for automatic deployment to GitHub Pages.

### Setup Steps

1. Create a GitHub repository and push your code
2. Go to repository Settings > Pages
3. Under "Build and deployment", select "GitHub Actions" as the source
4. Set the required secret in your repository:
   - Go to Settings > Secrets and variables > Actions
   - Add a new repository secret named `VITE_API_KEY` with your API key

The GitHub Action will automatically build and deploy your site whenever you push to the main branch.

## Local Development

```
npm install
npm run dev
```

## Configuration

- The API connects to Google Apps Script
- Make sure the Google Apps Script is deployed with "Anyone" access
- API key must match between frontend and backend