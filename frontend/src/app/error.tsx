'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Er is iets misgegaan!</h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'Er is een onverwachte fout opgetreden.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors"
        >
          Probeer opnieuw
        </button>
      </div>
    </div>
  )
}

