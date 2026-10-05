# ClipSync PRO — Universal Cross-Device Clipboard & File Transfer

**ClipSync Pro** is a modern, high-performance, and end-to-end encrypted shared clipboard web application designed for fast transfers between laptops, phones, and tablets.

---

## 🚀 Key Features

- **Text & Images/Files Together**: Attach screenshots, photos, or documents alongside your text notes in a single 6-digit clip.
- **6-Digit PIN & Live QR Code**: Instant mobile pairing by scanning the on-screen QR code with any smartphone camera or typing the 6-digit code.
- **Client-Side AES-GCM 256 Encryption**: Optional password/PIN protection computed directly in your browser with the native Web Crypto API before transfer.
- **Configurable Lifespan & Self-Destruct**: Burn-after-reading (destructs on 1st retrieval), 5 minutes, 1 hour, 24 hours, or 7 days.
- **Integrated Document & PDF Suite**: Built-in PDF to Word, Word to PDF, Image to PDF, Merge PDF, and Text to PDF converters with instant download & 1-click sharing to ClipSync.
- **Clip History Drawer**: Searchable history of sent and received clips with 1-click re-copying and star favorites.
- **Fast & Ethical**: Sub-50ms instant generation, zero ads, zero CPU-mining loops.
- **Sleek Gray & Yellow Aesthetic**: High-contrast modern industrial design with matte slate/charcoal tones, vibrant yellow accents, and seamless Dark/Light mode switching.

---

## 🌐 Deploying Live to Vercel

The project is pre-configured with `vercel.json` and a Serverless API (`api/clip.ts`). You can deploy it in 2 minutes using either method below:

### Option A: Using the Vercel CLI (Fastest — 1 command)

1. Open your terminal in this project folder:
   ```bash
   npx vercel
   ```
2. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? (Select your account)
   - Link to existing project? **N**
   - What's your project's name? `clipsync-pro` (or press Enter)
   - In which directory is your code located? `./` (press Enter)
   - Want to modify settings? **N**
3. When ready for production:
   ```bash
   npx vercel --prod
   ```
Your app will be live at `https://clipsync-pro.vercel.app`!

---

### Option B: Deploying via GitHub

1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ClipSync Pro"
   ```
2. Create a new repository on [GitHub](https://github.com/) and push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```
3. Go to [Vercel](https://vercel.com/new), click **"Import Project"**, and select your GitHub repository.
4. Keep the default settings (Framework: Vite, Build Command: `npm run build`, Output Directory: `dist`) and click **Deploy**.

---

## ⚡ Long-Term Persistent Storage on Vercel (Optional)

ClipSync Pro works out of the box with in-memory serverless caching and WebRTC peer syncing.

If you want persistent cloud storage across all Vercel regions and cold starts:
1. In your **Vercel Project Dashboard**, go to **Storage** tab.
2. Click **Create Database** → Select **KV** (or **Upstash Redis**).
3. Connect it to your project.
4. Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
5. ClipSync Pro will automatically detect it and enable Redis-backed cloud persistence!

---

## 💻 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build

# Run linter
npm run lint
```
