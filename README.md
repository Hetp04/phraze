# Phraze - Advanced LLM Development Platform

A powerful web application for highlighting, annotating, and organizing text from any webpage or LLM conversation. Built with React, Vite, and Firebase.

## 🌟 Features

- **Text Highlighting & Annotation**: Highlight and annotate text from any source
- **LLM Integration**: Connect with various language models for enhanced productivity
- **Team Collaboration**: Multiple users can chat, annotate, and share insights
- **Export Options**: Multiple export formats for your annotations
- **History Management**: Track and revisit your annotation history
- **Cross-Platform**: Works on web browsers and as a browser extension

## 🚀 Live Demo

Visit the live application: [https://hetp04.github.io/phraze/](https://hetp04.github.io/phraze/)

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: CSS3, Tailwind-inspired utilities
- **Backend**: Firebase (Authentication, Database)
- **AI Integration**: Groq API
- **Deployment**: GitHub Pages

## 📁 Project Structure

```
phraze-update-main/
├── src/                    # React source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── context/           # React context providers
│   ├── utils/             # Utility functions
│   └── services/          # API services
├── public/                 # Static assets (images, videos, audio)
├── extension/              # Browser extension code
├── .github/workflows/      # GitHub Actions for deployment
└── scripts/                # Development scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project (for backend features)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hetp04/phraze.git
   cd phraze
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or use the convenience script
   ./scripts/start-local.sh
   ```

4. **Open your browser**
   - Local: http://localhost:5500
   - The app will automatically open in your default browser

### Production Build

```bash
npm run build
npm run preview
```

## 🌐 GitHub Pages Deployment

The application is automatically deployed to GitHub Pages via GitHub Actions. Every push to the `main` branch triggers a new deployment.

- **Build**: Uses Vite to build the React app
- **Deploy**: Automatically deploys to `https://hetp04.github.io/phraze/`
- **Assets**: All images, videos, and media files are served from the `public/` folder

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_GROQ_API_KEY=your_groq_api_key
```

### Firebase Setup

1. Create a Firebase project
2. Enable Authentication and Firestore
3. Add your Firebase configuration to `src/firebase-init.js`

## 📱 Browser Extension

The project includes a browser extension for enhanced functionality:

- **Location**: `extension/` folder
- **Installation**: Load as unpacked extension in Chrome/Edge
- **Features**: Text highlighting, annotation, and data collection

## 🎨 Customization

### Styling
- Main styles: `src/App.css` and `styles/main.css`
- Component-specific styles are inline for easy modification

### Assets
- Images and videos: `public/` folder
- All assets are automatically optimized for both local development and GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/Hetp04/phraze/issues) page
2. Create a new issue with detailed information
3. Include browser console logs and steps to reproduce

## 🔄 Updates

The application automatically updates when you push to the `main` branch. GitHub Actions will:

1. Build the application
2. Run tests (if configured)
3. Deploy to GitHub Pages
4. Update the live site

---

**Built with ❤️ by Het Patel**

Visit: [https://hetp04.github.io/phraze/](https://hetp04.github.io/phraze/)
