import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { api } from './api/client'
import App from './App'
import SmoothScroll from './components/SmoothScroll'
import './index.css'

// Warm up the serverless API so the first real request skips the cold start.
api.get('/health').catch(() => {})

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
        <ThemeProvider>
          <SmoothScroll />
          <MotionConfig reducedMotion="user"><App /></MotionConfig>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
