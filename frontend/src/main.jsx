import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'
import SmoothScroll from './components/SmoothScroll'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <SmoothScroll />
          <MotionConfig reducedMotion="user"><App /></MotionConfig>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
