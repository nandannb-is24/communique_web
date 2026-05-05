# Communiqué Letter Generator (Web Version)

A professional letter generator with real-time A4 preview, manual table breaks, and draggable signatures. Designed for cadets and batchmates to quickly generate formal letters.

## 🚀 How to Deploy on Vercel

This application is built with Vite and React, making it incredibly easy to deploy on Vercel.

1. **Import the Repository**:
    * Go to [Vercel.com/new](https://vercel.com/new).
    * Connect your GitHub account and select this `Communique-web` repository.
    * Vercel will automatically detect the Vite framework and configure the build settings.

2. **Configure Environment Variables (Crucial Step)**:
    * Before clicking Deploy, expand the **Environment Variables** section.
    * Add a new variable:
      * **Name**: `VITE_GROQ_API_KEY`
      * **Value**: *(Paste your Groq API key here, e.g., `gsk_woQUHf...`)*
    * Click **Add**.

3. **Deploy**:
    * Click the **Deploy** button.
    * Wait a few seconds for the build to finish. Your app will now be live at a public URL!

## 📖 User Manual (Field Manual)

### 1. Basic Setup
*   **Ready to Go**: The AI features are pre-configured. You don't need to enter any API keys—just start writing!
*   **Header**: Choose your letter type (To Address, Submitted, or Through). The layout will adjust automatically.

### 2. Smart Tables (The Cadet List)
*   **Selection**: Check the boxes next to the cadets you want to include in the letter. Only checked cadets will appear in the final PDF.
*   **Manual Page Breaks (The Scissors ✂️)**: 
    *   If your table is too long and breaks awkwardly, click the **Scissors icon** on a row to force the table to split and continue on the next page. 

### 3. Body & Closing Paragraphs
*   Use the **Bold**, *Italic*, and __Underline__ tools in the toolbar.
*   Click the ✨ **Sparkles icon** next to a paragraph to let the AI rewrite it into a more professional formal tone instantly.

### 4. The Floating Signature ✍️
*   The signature is "Floating." This means you can **click and drag** it anywhere on the page—over text, into margins, or at the bottom.

### 5. Finalizing
*   Click **"Save as PDF"**. Ensure your printer settings have "Margins: None" or "Default" for the best A4 fit.

---
**Created with ❤️ and a bit of 'Josh' for the batch.**  

**⚠️ PROTOTYPE NOTICE**  
For any bugs or feature requests, please contact: `rvcecdtnandannaniyappanb@gmail.com`
