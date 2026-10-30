import { checkBuildHash } from './lib/buildHash'
checkBuildHash()

import { installErrorReporter } from './lib/errorReporter'
installErrorReporter()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BillPaymentPage from './pages/BillPaymentPage.jsx'

const path = window.location.pathname

if (path === '/bill-payment') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BillPaymentPage />
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
