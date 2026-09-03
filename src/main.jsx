import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './contexts/LanguageContext'
import AutoTranslateLayer from './components/AutoTranslateLayer'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <AutoTranslateLayer />
      <App />
    </LanguageProvider>
  </StrictMode>,
)
