import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeBootstrapData } from './services/dataService'

function bootstrap() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  void initializeBootstrapData()
}

void bootstrap()
