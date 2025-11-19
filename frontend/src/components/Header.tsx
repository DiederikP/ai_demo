'use client';

import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-barnes-orange flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div className="text-2xl font-semibold text-barnes-dark-violet">Barnes AI</div>
        </div>
      </div>
      
      <nav className="hidden md:flex gap-8 text-sm font-medium">
        <a href="#features" className="text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Features</a>
        <a href="#try" className="text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Try It</a>
        <a href="#pricing" className="text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Pricing</a>
      </nav>
      
      <div className="hidden md:flex gap-4">
        <a href="#pricing" className="btn-secondary text-sm">Contact Sales</a>
        <a href="/company/login" className="btn-primary text-sm">Company Login</a>
      </div>

      {/* Mobile menu button */}
      <button 
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg md:hidden animate-slide-up">
          <div className="px-8 py-4 space-y-4">
            <a href="#features" className="block text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Features</a>
            <a href="#try" className="block text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Try It</a>
            <a href="#pricing" className="block text-barnes-dark-gray hover:text-barnes-violet transition-colors duration-200">Pricing</a>
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <a href="#pricing" className="btn-secondary text-sm w-full">Contact Sales</a>
              <a href="/company/login" className="btn-primary text-sm w-full">Company Login</a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
