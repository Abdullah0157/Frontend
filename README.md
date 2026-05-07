# JobStream Frontend

Modern Next.js job listing platform with Tailwind CSS. Ready to deploy on Vercel.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone or navigate to the project
cd jobstream-frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Update .env.local with your values
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 📝 Environment Variables

Create a `.env.local` file:

```env
# Your FastAPI Backend URL (Hugging Face)
NEXT_PUBLIC_API_URL=https://your-huggingface-space.hf.space/api

# Your Micro1 referral code
NEXT_PUBLIC_REFERRAL_CODE=YOUR_MICRO1_REFERRAL_CODE

# LinkedIn page URL
NEXT_PUBLIC_LINKEDIN_URL=https://linkedin.com/company/jobstream

# Your site URL
NEXT_PUBLIC_SITE_URL=https://jobstream.com
```

---

## 🌐 Deploy to Vercel

### Method 1: GitHub + Vercel (Recommended)

1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_REFERRAL_CODE
vercel env add NEXT_PUBLIC_LINKEDIN_URL
vercel env add NEXT_PUBLIC_SITE_URL

# Deploy to production
vercel --prod
```

---

## 📁 Project Structure

```
jobstream-frontend/
├── app/
│   ├── layout.js          # Root layout
│   ├── page.js            # Home page
│   ├── jobs/
│   │   ├── page.js        # Jobs listing page
│   │   └── [id]/
│   │       └── page.js    # Job detail page
│   └── styles/
│       └── globals.css    # Global styles
├── components/
│   ├── Header.js          # Navigation header
│   ├── Footer.js          # Footer
│   ├── JobCard.js         # Job card component
│   └── SearchBar.js       # Search component
├── public/                # Static assets
├── package.json
├── next.config.js
├── tailwind.config.js
└── .env.example          # Environment template
```

---

## 🔧 API Integration

This frontend connects to your FastAPI backend. Make sure your backend provides:

### Required Endpoints

#### GET `/api/jobs`
Returns list of all jobs
```json
{
  "data": [
    {
      "id": 1,
      "title": "Full Stack Developer",
      "company": "TechCorp",
      "location": "Remote",
      "job_type": "Full-time",
      "salary_range": "$80k - $120k",
      "description": "...",
      "tags": ["React", "Node.js"],
      "apply_url": "https://micro1.com/apply?job_id=1",
      "posted_date": "2026-01-15"
    }
  ]
}
```

#### GET `/api/jobs/{id}`
Returns single job detail
```json
{
  "id": 1,
  "title": "Full Stack Developer",
  "company": "TechCorp",
  "location": "Remote",
  "job_type": "Full-time",
  "salary_range": "$80k - $120k",
  "description": "Full job description...",
  "requirements": ["5+ years experience", "React knowledge"],
  "tags": ["React", "Node.js"],
  "company_description": "About the company...",
  "apply_url": "https://micro1.com/apply?job_id=1",
  "posted_date": "2026-01-15"
}
```

---

## 🎨 Customization

### Colors
Edit `tailwind.config.js` to change theme colors:
```js
colors: {
  primary: '#0088cc',
  secondary: '#00a8e8',
}
```

### Fonts
Update in `tailwind.config.js`:
```js
fontFamily: {
  sans: ['Your Font Family', 'sans-serif'],
}
```

### Logo
Update in `components/Header.js` and `components/Footer.js`

---

## 📊 Features

✅ Job listing with filtering  
✅ Search functionality  
✅ Individual job detail pages  
✅ Mobile responsive  
✅ Fast page loads (Next.js)  
✅ SEO optimized  
✅ Connected to FastAPI backend  
✅ Referral link integration  
✅ LinkedIn integration  

---

## 🔗 Next Steps

1. Deploy frontend to Vercel
2. Create FastAPI backend (see backend guide)
3. Connect frontend to backend
4. Start posting jobs on LinkedIn
5. Drive traffic to your website

---

## 📞 Support

Need help? Check these files:
- `.env.example` - Environment setup
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Styling configuration

---

## 📄 License

MIT License - Feel free to use for your JobStream project
