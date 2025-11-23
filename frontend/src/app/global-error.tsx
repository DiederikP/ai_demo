'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Er is een kritieke fout opgetreden</h2>
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
      </body>
    </html>
  )
}

