<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/19eb281a-3395-464f-9b30-6f19e03a83e9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Adding Gemini features

Do NOT add `GEMINI_API_KEY` to the client bundle. The previous `vite.config.ts`
embedded the key in public JS. If a Gemini feature is needed:

1. Create a Firebase Cloud Function (or other server endpoint).
2. Function reads `process.env.GEMINI_API_KEY` at runtime — never inlined.
3. Client calls the function via `httpsCallable` with the user's ID token.
4. Server validates the user's role from the token before forwarding the prompt.
