# Netlify Deploy Instructions

## Quick Start
1. Sign up for a free account at [Netlify](https://www.netlify.com/)
2. Click "Add new site" > "Import an existing project" > "Deploy with GitHub"
3. Select the "ayathanschool/fee-app" repository
4. Set the VITE_API_KEY environment variable (see below)
5. Click "Deploy site"

## Detailed Instructions

### 1. Create Netlify Account
- Go to [netlify.com](https://www.netlify.com/) and sign up
- You can sign up with your GitHub account for easier integration

### 2. Connect Your Repository
- After signing in, click the "Add new site" button in your dashboard
- Select "Import an existing project"
- Choose "GitHub" as your Git provider
- Authorize Netlify to access your GitHub repositories if prompted
- Find and select the "ayathanschool/fee-app" repository

### 3. Configure Build Settings
The following settings should be automatically detected from your netlify.toml file:
- Build command: `npm run build`
- Publish directory: `dist`

### 4. Set Environment Variables
- Before deploying, expand the "Advanced" or "Advanced build settings" section
- Add a new environment variable:
  - Key: `VITE_API_KEY`
  - Value: `feemgr-2025` (or your actual API key)

### 5. Deploy
- Click "Deploy site" to start the deployment process
- Netlify will build your project and deploy it to a random URL like `random-name-123456.netlify.app`

### 6. Access Your Site
- Once deployment is complete, you'll see a notification
- Click the URL Netlify provides to view your deployed app
- Verify that the app loads correctly and that navigation works

## Additional Information

### Custom Domain (Optional)
- In your site dashboard, go to "Site settings" > "Domain management"
- You can add a custom domain if you have one

### Continuous Deployment
- Any changes pushed to your main branch will automatically trigger a new deployment
- You can view deployment history and logs in the "Deploys" section of your site dashboard

### Troubleshooting
If your deployment fails or the site doesn't work correctly:
1. Check the build logs in the "Deploys" section
2. Verify your environment variables are set correctly
3. Check the "Functions" tab if you're using any Netlify Functions

Need help? Contact Netlify support or refer to their documentation at [docs.netlify.com](https://docs.netlify.com/).