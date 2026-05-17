import { checkBuildHash } from './lib/buildHash'
checkBuildHash()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CheckoutRedirect from './pages/CheckoutRedirect.jsx'

if (window.location.pathname === '/checkout') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <CheckoutRedirect />
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
