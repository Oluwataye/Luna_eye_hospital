import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

console.log("%c LUNA_SYSTEM_RELOAD_SUCCESS_VER_2.1", "background: #222; color: #bada55; font-size: 20px; font-weight: bold; padding: 10px;");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
