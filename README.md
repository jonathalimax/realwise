# Finance Tracker App

A simple, secure web application to track your income and expenses. Built with React, Vite, Tailwind CSS, and Firebase.

## Features

- **User Authentication**: Secure login with email/password or Google Sign-In
- **Add Transactions**: Track income and expenses with categories
- **Real-time Updates**: See your balance and transactions update instantly
- **Balance Summary**: View total income, expenses, and current balance
- **Transaction History**: See all your transactions with the ability to delete them
- **Cloud Storage**: All data safely stored in Firebase (free tier)
- **Responsive Design**: Works on desktop and mobile devices

## Screenshots

The app includes:
- Beautiful gradient dashboard
- Easy-to-use transaction form
- Real-time balance summary cards
- Transaction list with delete functionality
- Secure authentication

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd limas-finance
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Give your project a name (e.g., "my-finance-tracker")
4. You can disable Google Analytics if you don't need it

### 4. Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. (Optional) Enable **Google** sign-in method for Google authentication

### 5. Create Firestore Database

1. In your Firebase project, go to **Firestore Database** in the left sidebar
2. Click "Create database"
3. Start in **production mode** (we'll set up rules next)
4. Choose a location closest to your users

### 6. Set Up Firestore Security Rules

1. Go to the **Rules** tab in Firestore
2. Replace the rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{transaction} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

3. Click **Publish**

### 7. Get Your Firebase Configuration

1. In Firebase Console, click the gear icon next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Register your app (give it a nickname)
6. Copy the `firebaseConfig` object values

### 8. Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` and fill in your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 9. Run the App

```bash
npm run dev
```

The app should now be running at `http://localhost:5173`

## Deployment

### Deploy to Firebase Hosting (Free)

1. Install Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Login to Firebase:

```bash
firebase login
```

3. Initialize Firebase hosting:

```bash
firebase init hosting
```

- Choose your existing project
- Set build directory to: `dist`
- Configure as single-page app: Yes
- Don't overwrite index.html

4. Build and deploy:

```bash
npm run build
firebase deploy
```

Your app will be live at `https://your-project-id.web.app`

### Deploy to Vercel (Free)

1. Install Vercel CLI:

```bash
npm install -g vercel
```

2. Deploy:

```bash
npm run build
vercel
```

Follow the prompts and your app will be live!

### Deploy to Netlify (Free)

1. Build the app:

```bash
npm run build
```

2. Drag and drop the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)

Or use Netlify CLI:

```bash
npm install -g netlify-cli
netlify deploy
```

## Technology Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Hosting**: Firebase Hosting / Vercel / Netlify (your choice)

## Security Features

- Firebase Authentication for secure user management
- Firestore security rules ensure users can only access their own data
- Environment variables keep sensitive credentials secure
- No API keys exposed in the client code

## Usage

1. **Sign Up**: Create an account with email/password or Google
2. **Add Transactions**: Use the form to add income or expenses
3. **View Balance**: See your financial summary at the top
4. **Manage Transactions**: View history and delete transactions as needed
5. **Sign Out**: Click the sign-out button when done

## Free Tier Limits

Firebase free tier (Spark plan) includes:
- 50,000 document reads/day
- 20,000 document writes/day
- 20,000 document deletes/day
- 1 GB storage
- 10 GB/month bandwidth

This is more than enough for personal use!

## Troubleshooting

### Firebase initialization error
- Make sure all environment variables in `.env` are correctly set
- Ensure you've enabled Authentication and Firestore in Firebase Console

### "Missing or insufficient permissions" error
- Check that Firestore security rules are properly configured
- Ensure you're signed in with a valid account

### Transactions not appearing
- Verify Firestore rules allow read/write access
- Check browser console for any errors
- Make sure you created the Firestore database

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions, please open an issue on GitHub.
