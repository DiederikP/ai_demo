'use client';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-12 mt-12 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-barnes-orange flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="text-lg font-semibold text-barnes-dark-violet">Barnes AI</div>
            </div>
            <p className="text-sm text-barnes-dark-gray">
              Professional AI-powered candidate evaluation service by Barnes.nl
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-barnes-dark-violet mb-3">Product</h3>
            <ul className="space-y-2 text-sm text-barnes-dark-gray">
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Features</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Pricing</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">API</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-barnes-dark-violet mb-3">Company</h3>
            <ul className="space-y-2 text-sm text-barnes-dark-gray">
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">About</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Contact</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Support</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-barnes-dark-violet mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-barnes-dark-gray">
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Privacy</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Terms</a></li>
              <li><a href="#" className="hover:text-barnes-violet transition-colors duration-200">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-8 pt-8 text-sm text-barnes-dark-gray text-center">
          © {new Date().getFullYear()} Barnes.nl. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
