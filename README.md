# NexusHire (by Team Ace of Roots)

> **Problem Statement:** PS 3 - Job Portal Website  
> **Category:** Web / App Development  
> **Team Name:** Ace of Roots  
> **Leader:** Manglam Jaiswal  

**NexusHire** is a next-generation, AI-driven recruitment platform that bridges the gap between candidates and recruiters using advanced parsing, multi-dimensional semantic matching, contextual feedback, and high-performance interactive visualizations.

---

## ⚡ Core Features

### 🏢 For Recruiters
- **3D Opportunity Graph:** A visually stunning `react-force-graph-3d` visualization mapping job requirements to candidate capabilities for immediate talent discovery.
- **AI-Powered Semantic Matching:** Automatically ranks applicants against job descriptions using Groq inference (Llama 3/Mixtral) beyond exact keyword matches.
- **Pusher Real-Time Kanban Pipeline:** Drag-and-drop candidates through stages (Applied, Under Review, Shortlisted, Interview, Decision, Outcome) with zero refresh required.
- **Automated Communication:**
  - Fire-and-forget stage update notifications to candidates.
  - "Unicorn Alert" email triggers when a 85%+ matched candidate applies.
  - Daily pipeline summary cron jobs.
- **Secure S3 Document Storage:** Candidate resumes are parsed server-side and safely stored on AWS S3 using presigned, short-lived URLs.
- **One-Click Offers:** Instant professional PDF offer letter generation attached seamlessly to "You're Hired" emails.

### 👤 For Candidates
- **AI Mock Interviewer:** An interactive, voice-to-voice AI interviewer that dynamically asks technical and behavioral questions specifically tailored to the candidate's resume and the target job description.
- **Deep Resume Parsing:** Extracts skills, categorizes them, standardizes proficiencies, and aligns past experience using custom AI pipelines.
- **Skill Gap & Rejection Analysis:** If rejected, candidates don't just get a generic refusal; they receive an AI-generated personalized learning pathway explaining exactly *why* based on recruiter notes and missing JD variables.
- **Transparent Tracking:** Candidates get real-time email triggers and dynamic UI indicators for the precise stage their application is at.
- **ATS Optimizer:** Built-in recommendations for optimizing resumes for specific job descriptions prior to applying.

---

## 🛠️ Technology Stack

This application is built with a deep, modern full-stack web architecture leveraging Edge features and high-concurrency external APIs.

**Frontend:**
- **Next.js 14 (App Router)** - Server and Client Components.
- **React 18** - With modern hooks schema and suspense.
- **Tailwind CSS + Framer Motion** - Deep aesthetic integration, glassmorphism, dynamic animations.
- **Three.js + Spline** - High fidelity 3D backgrounds and interactive UI environments.
- **Dnd-Kit** - For accessible, robust Kanban pipeline implementation.
- **Chart.js & D3** - Radar compatibility graphs and analytical components.

**Backend & Database:**
- **Node.js + Edge API Routes** - Utilizing Next.js Route Handlers.
- **MongoDB + Mongoose** - Relational graph approximations modeled using extensive arrays, embeddings, and lookup queries.
- **Auth.js v5 (NextAuth)** - Secure OAuth/credential sessions.
- **Pusher** - WebSockets for immediate bi-directional event syncing.

**AI & Utilities:**
- **Groq SDK** - Lighting-fast inference for generative intelligence, interactive voice mock interviews (Chat & Whisper), resume parsing, missing skill identification, and contextual rejection logic.
- **AWS S3** - Decentralized block storage for PDF documents.
- **Nodemailer + PDFKit** - Secure SMTP delivery sequences with built-in runtime document processing/generation.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node 18+ and `npm` or `yarn` installed. You will also need a MongoDB cluster and an AWS S3 bucket.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/nexushire.git
   cd nexushire
   ```

2. **Install dependencies**
   *(Note: Ensure `--legacy-peer-deps` if dealing with strict React 18 conflicts)*
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Create a `.env.local` file in the root directory. You will need:
   ```env
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Database
   MONGODB_URI=mongodb+srv://...

   # Auth
   NEXTAUTH_SECRET=your_super_secret_string
   NEXTAUTH_URL=http://localhost:3000

   # Groq (AI capabilities)
   GROQ_API_KEY=gsk_...

   # AWS S3 (Resumes/Documents)
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=nexushire-resumes

   # SMTP (Email Triggers)
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password

   # Pusher (Real-Time Kanban)
   NEXT_PUBLIC_PUSHER_KEY=...
   NEXT_PUBLIC_PUSHER_CLUSTER=...
   PUSHER_APP_ID=...
   PUSHER_SECRET=...

   # Cron
   CRON_SECRET=...
   ```

4. **Boot the Development Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` inside your browser.

---

## 🎨 Design Philosophy
*NexusHire* was intentionally designed not just to function, but to feel inherently premium. Deep purple hues, violet radial glows, smooth Framer Motion layout transitions, and an interactive Spline 3D focal landing environment exist fundamentally to **wow** users at first interaction. We refuse to use placeholder elements; every graph dynamically pulls real semantic properties matching candidate arrays against strict Job Description weightings. 

## 🏗️ Core Modules
- **`/app/recruiter/`**: Contains the pipeline architecture, graph visualizations, candidate bulk tools, and the job creation workflows.
- **`/app/candidate/`**: Contains the interactive 3D mock interviewer, skill gap paths, resume parsing UX, ATS compatibility checks, and job explorers.
- **`/lib/ai/`**: Abstracted prompt matrices utilized directly by the Groq infrastructure.
- **`/lib/mailer.ts`**: The abstracted async logic pipeline for firing templates (Receipts, Outcome, Offers).
- **`/components/kanban/`**: The abstracted dnd-kit modules running the recruiter board.

---

*Built with passion by Team Ace of Roots.*
