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
          {/* Keep local previews animated for design review; production still follows the OS preference. */}
          <MotionConfig reducedMotion={import.meta.env.PROD ? 'user' : 'never'}><App /></MotionConfig>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
