import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import '../index.css' // Tailwind styles (optional but needed if using Tailwind)

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)