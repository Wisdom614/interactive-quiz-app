# Kinetic AI - Real-Time AI Multiplayer Trivia Arena

Kinetic AI is a live, high-speed multiplayer trivia platform engineered with **Next.js 16 (Turbopack)**, **Supabase Realtime**, **KaTeX mathematical rendering**, and high-performance AI question generation (supporting **GroqCloud** and **xAI Grok**).

Designed with a crisp **Swiss Neo-Minimalist editorial aesthetic** (straight 0px edges, monospace precision typography, and zero layout shift), Kinetic AI enables creators to generate custom quizzes on any subject in seconds and host live multiplayer games on big screens with players joining instantly from their phones.

---

## Key Features

- **Sub-Second Real-Time Multiplayer**: Instant state synchronization, answers, scores, and live vector reaction emotes powered by Supabase Broadcast channels and BroadcastChannel fallback.
- **AI-Powered Question Engine**: Multi-provider support for **GroqCloud** (`openai/gpt-oss-120b`) and **xAI** (`grok-2-latest`) with smart validation, plausible distractors, and analytical host commentary.
- **Full Mathematical & Scientific Formula Rendering**: Integrated with **KaTeX** to render complex mathematical equations, calculus integrals ($\int$), fractions ($\frac{a}{b}$), roots ($\sqrt{x}$), limits ($\lim$), Greek symbols ($\pi, \theta, \alpha, \lambda$), and physics/chemistry equations.
- **Auto-Starting Countdown Timers**: Hosts can set automated takeoff timers (e.g. 1m, 2m, 5m, 10m) that automatically start the game when the countdown reaches zero.
- **Candidate Limit Enforcement**: Hosts can configure maximum capacity caps (e.g. 5, 10, 25, 50 players, or unlimited) with real-time rejection of overflow entries.
- **Public Games Discovery Feed**: Incoming candidates see live pending lobbies on the home page and can join with one click or enter a 6-character Game PIN.
- **Creator Studio & Pre-Start Editor**: Authenticated quiz creators can review game history, rehost past quizzes, and edit questions, options, and correct answers directly in real time before takeoff.
- **1-on-1 Solo Duel Mode**: Play against an AI opponent with real-time speed scoring and answer reveal analytics.
- **Synthesized Web Audio Soundscape**: 8-bit / modern frequency synthesized sound effects for clicks, countdown ticks, correct/wrong answers, and podium reveals with zero external audio assets.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Styling**: Tailwind CSS (Swiss Neo-Minimalist, `rounded-none`, high-contrast palette)
- **Real-Time Backend**: Supabase (PostgreSQL & Realtime Broadcast)
- **AI Engine**: Groq Cloud / xAI Grok
- **Math Engine**: KaTeX (`katex.min.css`)
- **Icons & Avatars**: Lucide Icons & Custom Vector Monograms
- **QR Codes**: `qrcode.react`

---

## Getting Started Locally

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Wisdom614/interactive-quiz-app.git
cd interactive-quiz-app
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your active credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GROQ_API_KEY=gsk_your_groq_api_key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying on Vercel

1. Push your repository to GitHub:
   ```bash
   git push -u origin main
   ```
2. Import the project in [Vercel Dashboard](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY` (or `XAI_API_KEY`)
4. Click **Deploy**.

---

## Database Schema (Optional)

If using Supabase PostgreSQL tables alongside Realtime Broadcast:
Execute [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL Editor.

---

## License
MIT License
