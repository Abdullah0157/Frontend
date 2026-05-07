# JobStream Frontend - Complete Setup Guide

## ✅ Frontend Complete! 

Your Next.js frontend is ready with all the components and pages. Here's what was created:

---

## 📁 Project Structure Created

```
jobstream-frontend/
│
├── 📄 package.json                    ← Dependencies
├── 📄 next.config.js                  ← Next.js config
├── 📄 tailwind.config.js              ← Tailwind config
├── 📄 postcss.config.js               ← PostCSS config
├── 📄 .env.example                    ← Environment template
├── 📄 .gitignore                      ← Git ignore
├── 📄 README.md                       ← Documentation
│
├── app/
│   ├── layout.js                      ← Root layout (Header + Footer)
│   ├── page.js                        ← Home page (Hero + Featured jobs)
│   ├── jobs/
│   │   ├── page.js                    ← All jobs listing with filters
│   │   └── [id]/
│   │       └── page.js                ← Individual job detail page
│   └── styles/
│       └── globals.css                ← Global CSS + Tailwind
│
├── components/
│   ├── Header.js                      ← Navigation (responsive)
│   ├── Footer.js                      ← Footer with links
│   ├── JobCard.js                     ← Reusable job card
│   └── SearchBar.js                   ← Job search input
│
└── public/                            ← Static files (add logo here)
```

---

## 🎯 What Each File Does

### Pages (User-facing)
- **Home** (`app/page.js`) - Landing page with featured jobs
- **All Jobs** (`app/jobs/page.js`) - Job listing with filters & search
- **Job Detail** (`app/jobs/[id]/page.js`) - Full job details + apply button

### Components (Reusable)
- **Header** - Navigation with JobStream logo & menu
- **Footer** - Links, social, copyright
- **JobCard** - Individual job preview card
- **SearchBar** - Search input with clear button

### Configuration
- **tailwind.config.js** - Blue color theme, JobStream branding
- **next.config.js** - Backend API URL environment setup
- **postcss.config.js** - Tailwind CSS processor

---

## 🚀 Step 1: Setup Your Frontend Locally

```bash
# 1. Create project folder
mkdir jobstream-frontend
cd jobstream-frontend

# 2. Initialize Node project
npm init -y

# 3. Install dependencies
npm install next react react-dom axios tailwindcss postcss autoprefixer

# 4. Copy all the files created above into this folder
# (You can copy them one by one or ask me to create a zip)

# 5. Create .env.local
cp .env.example .env.local

# 6. Edit .env.local with your values
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_REFERRAL_CODE=your_micro1_referral_code
NEXT_PUBLIC_LINKEDIN_URL=https://linkedin.com/company/jobstream

# 7. Test locally
npm run dev

# Visit http://localhost:3000 in browser
```

---

## 📌 Important: API Connection Points

Your frontend will call these endpoints from your FastAPI backend:

```javascript
// app/page.js (line 18)
const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/jobs`)

// app/jobs/page.js (line 21)
const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/jobs?limit=100`)

// app/jobs/[id]/page.js (line 19)
const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${jobId}`)
```

These will work once your FastAPI backend is ready.

---

## 🌐 Step 2: Deploy to Vercel

### Option A: GitHub + Vercel (Easiest)

```bash
# 1. Initialize git
git init
git add .
git commit -m "Initial commit"

# 2. Push to GitHub
git branch -M main
git remote add origin https://github.com/yourusername/jobstream-frontend.git
git push -u origin main

# 3. Go to Vercel
# Visit https://vercel.com/new
# Import your GitHub repository

# 4. Add Environment Variables in Vercel Dashboard
# Settings → Environment Variables
NEXT_PUBLIC_API_URL=https://your-fastapi-backend.com/api
NEXT_PUBLIC_REFERRAL_CODE=your_code
NEXT_PUBLIC_LINKEDIN_URL=https://linkedin.com/company/jobstream
NEXT_PUBLIC_SITE_URL=https://your-jobstream-domain.vercel.app

# 5. Deploy!
# Vercel auto-deploys on git push
```

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel
# Follow the prompts
```

---

## ✨ Features Included

✅ **Home Page**
- Hero section with JobStream branding
- Featured job listings
- Call-to-action buttons
- Mobile responsive

✅ **Jobs Listing Page**
- Grid/list view of all jobs
- Sidebar filters (job type, search)
- Sort options (latest, salary)
- Search functionality

✅ **Job Detail Page**
- Full job description
- Salary, location, type info
- Requirements list
- "Apply Now" button with referral link

✅ **Components**
- Responsive Header with mobile menu
- Clean Footer with links
- Job cards with preview
- Search bar with clear button

✅ **Styling**
- Tailwind CSS (fast, modern)
- Blue theme (JobStream branding)
- Mobile responsive (mobile-first)
- Smooth animations

---

## 🔗 Next: Backend Setup

Once your frontend is deployed to Vercel, we need to create the **FastAPI Backend** that:

1. Pulls jobs from Micro1 API
2. Stores them in database
3. Provides REST API endpoints
4. Tracks referrals

Ready for the backend? I'll create:
- ✅ FastAPI server setup
- ✅ Database models
- ✅ Job routes
- ✅ Referral tracking
- ✅ Deployment guide for Hugging Face

---

## 📝 Quick Checklist

- [ ] Copy all files into your project
- [ ] Install dependencies: `npm install`
- [ ] Create `.env.local` with your values
- [ ] Test locally: `npm run dev`
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Share your Vercel URL
- [ ] Then we build the FastAPI backend

---

## 🆘 Troubleshooting

**Q: Frontend won't load?**
A: Make sure `.env.local` is created and `npm install` was run

**Q: "Cannot find module" errors?**
A: Run `npm install` again, delete node_modules, run `npm install`

**Q: API calls failing?**
A: That's okay - backend isn't ready yet. Wait until we create FastAPI

**Q: Want to change colors/branding?**
A: Edit `tailwind.config.js` and component colors

---

Ready to move forward? Let me know when you've got the frontend files downloaded, and we'll create the **FastAPI Backend** next! 🚀
