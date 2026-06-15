import { checkBuildHash } from './lib/buildHash'
checkBuildHash()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CheckoutRedirect from './pages/CheckoutRedirect.jsx'
import Home from '../landing_page/pages/home.jsx'

const path = window.location.pathname

function getPromoCode() {
  const match = path.match(/^\/promo\/([^/]+)/)
  return match ? match[1] : null
}

const promoCode = getPromoCode()

if (path === '/checkout') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <CheckoutRedirect />
    </StrictMode>,
  )
} else if (promoCode) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Home couponCode={promoCode} />
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
