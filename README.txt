SUPER SIMPLE RUN:
1) Unzip this folder.
2) Open it in VS Code.
3) In the terminal, run:
   npm install
   npm run dev
4) Open the URL printed (e.g., http://localhost:5173) and hard reload (Ctrl+Shift+R).

Why this works:
- All API calls go to /gas on localhost.
- Vite proxy forwards /gas to your Apps Script deployment:
  https://script.google.com/macros/s/AKfycbwZBWak3p40iIEO8fAX1js014xRj401q8VvceYNU3z8IERTTpnfNlsUioSVl0aKgNU/exec

You do NOT need to edit any URLs.
