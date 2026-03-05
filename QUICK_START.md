# Quick Start Guide - Firebase & Google Drive Integration

## 🚀 What's New

Your scanner app now has:
- ✅ **Google Sign-In** - Secure authentication with Google accounts
- ✅ **Cloud Storage** - Automatic PDF upload to Google Drive
- ✅ **User Isolation** - Each user's documents stored separately
- ✅ **Upload Progress** - Real-time upload status indicators

## 📋 Quick Setup (5 Steps)

### 1. Create Firebase Project
- Go to https://console.firebase.google.com/
- Create new project → Enable Google Authentication

### 2. Enable Google Drive API
- Go to https://console.cloud.google.com/
- Enable "Google Drive API"

### 3. Get Credentials
- Firebase: Copy API key, project ID, etc.
- Google Cloud: Create OAuth Client ID and API Key

### 4. Create .env File
Create `c:\Users\nasih\scanmain\.env` with your credentials:
```env
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_API_KEY=your_api_key_here
```

### 5. Run the App
```bash
npm run dev
```

## 📖 Full Documentation

- **[SETUP_GUIDE.md](file:///C:/Users/nasih/.gemini/antigravity/brain/ee8b06ac-f322-461b-8430-16e8b1f74e0d/SETUP_GUIDE.md)** - Detailed setup instructions with screenshots
- **[walkthrough.md](file:///C:/Users/nasih/.gemini/antigravity/brain/ee8b06ac-f322-461b-8430-16e8b1f74e0d/walkthrough.md)** - Complete implementation details

## 🎯 How It Works

1. **User opens app** → Sees login screen
2. **Clicks "Sign in with Google"** → Google OAuth popup
3. **Grants permissions** → Authenticated and redirected to home
4. **Scans document** → Creates PDF
5. **Auto-upload** → PDF saved to Google Drive automatically
6. **Success** → "Saved to Google Drive" confirmation

## 🔧 Key Files Created

```
src/app/
├── config/firebase.config.ts       # Firebase setup
├── contexts/AuthProvider.tsx       # Auth state management
├── services/googleDrive.service.ts # Drive API integration
├── hooks/useAuth.ts                # Auth hook
├── hooks/useGoogleDrive.ts         # Drive operations hook
└── components/LoginScreen.tsx      # Sign-in UI
```

## ⚠️ Important Notes

- **Never commit `.env` file** - It's already in `.gitignore`
- **Internet required** - For authentication and uploads
- **OAuth setup** - Add `http://localhost:5173` to authorized origins
- **Drive folder** - Documents saved in `/ScannerApp/` folder

## 🐛 Troubleshooting

**Can't sign in?**
- Check Firebase Authentication is enabled
- Verify OAuth origins include `http://localhost:5173`

**Upload fails?**
- Ensure Google Drive API is enabled
- Check API key restrictions

**Environment variables not working?**
- Restart dev server after creating `.env`
- Check for typos in variable names

## 📞 Need Help?

Refer to the detailed [SETUP_GUIDE.md](file:///C:/Users/nasih/.gemini/antigravity/brain/ee8b06ac-f322-461b-8430-16e8b1f74e0d/SETUP_GUIDE.md) for step-by-step instructions with troubleshooting tips.
