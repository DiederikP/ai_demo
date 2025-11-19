'use client';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-barnes-light-gray to-white">
      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in">
          <h1 className="text-5xl font-extrabold leading-tight max-w-xl text-barnes-dark-violet">
            AI-Powered Candidate Evaluation
            <span className="block text-barnes-violet">That Actually Works</span>
          </h1>
          <p className="mt-6 text-lg max-w-lg text-barnes-dark-gray">
            Transform your hiring process with expert AI personas. Get comprehensive evaluations from Finance, HR, and Technical perspectives in minutes, not hours.
          </p>
          <div className="mt-8 flex gap-4">
            <button className="btn-primary animate-bounce-subtle">
              Start Free Trial
            </button>
            <button className="btn-secondary">
              Watch Demo
            </button>
          </div>
          <div className="mt-6 text-sm text-barnes-dark-gray">
            Trusted by HR teams at scale. No setup required.
          </div>
        </div>
        
        <div className="relative animate-slide-up">
          <div className="w-full h-64 bg-gradient-to-br from-barnes-orange to-barnes-violet rounded-2xl shadow-2xl flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-4xl mb-2">🤖</div>
              <div className="text-lg font-semibold">AI Evaluation Demo</div>
            </div>
          </div>
          <div className="absolute -bottom-8 right-8 p-4 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="text-sm font-medium text-barnes-dark-violet">Live Evaluation</div>
            <div className="text-xs text-barnes-dark-gray">Real-time AI assessment</div>
          </div>
        </div>
      </div>
    </section>
  );
}
