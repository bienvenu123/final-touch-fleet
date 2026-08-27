import React from 'react'
import './WhatsAppButton.css'

// Configure phone number and default message here
const PHONE = '0785201554'
const DEFAULT_MSG = 'Hello%20Fleet-Link!%20I%20would%20like%20to%20book%20a%20ride.'

export default function WhatsAppButton({ phone = PHONE, message = DEFAULT_MSG }) {
  const href = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`

  return (
    <a className="whatsapp-wrap" href={href} target="_blank" rel="noopener noreferrer">
      <div className="whatsapp-bubble">Contact us</div>
      <div className="whatsapp-btn" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20.52 3.48A11.9 11.9 0 0012 0C5.373 0 .01 5.373.01 12.002c0 2.117.554 4.186 1.605 6.015L0 24l6.185-1.584A11.94 11.94 0 0012 24c6.627 0 12.02-5.373 12.02-11.998 0-3.206-1.25-6.218-3.5-8.523zM12 21.6c-1.54 0-3.04-.42-4.335-1.2l-.31-.19-3.67.94.98-3.56-.2-.34A9.216 9.216 0 012.8 12.002c0-5.068 4.132-9.2 9.2-9.2 2.46 0 4.76.96 6.48 2.72 1.72 1.72 2.72 4.02 2.72 6.48 0 5.068-4.132 9.2-9.2 9.2zM17.2 14.24c-.28-.14-1.66-.82-1.92-.92-.26-.1-.45-.14-.64.14-.18.28-.72.92-.88 1.1-.16.18-.32.2-.6.06-.28-.14-1.18-.44-2.25-1.38-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.43.12-.57.12-.12.28-.32.42-.48.14-.16.18-.28.28-.46.1-.18.04-.34-.02-.48-.06-.12-.64-1.54-.88-2.12-.23-.56-.46-.48-.64-.48-.16 0-.34-.02-.52-.02-.18 0-.48.06-.73.34-.26.28-1 1-1 2.44s1.03 2.84 1.18 3.04c.14.18 2.04 3.12 4.96 4.38 2.74 1.18 2.74.78 3.24.72.5-.06 1.66-.68 1.9-1.34.24-.66.24-1.22.16-1.34-.08-.12-.28-.18-.56-.32z" />
        </svg>
      </div>
    </a>
  )
}
