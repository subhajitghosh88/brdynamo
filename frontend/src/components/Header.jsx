import React from 'react';

export default function Header({ onNavigate, activeMainView }) {
  const go = (target) => (e) => {
    e.preventDefault();
    if (onNavigate) onNavigate(target);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">BD</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">BRDynamo</h1>
              <p className="text-xs text-slate-500">AI-Powered SDLC Generation</p>
            </div>
          </div>

          {/* Enhanced Navigation */}
          <nav className="flex items-center gap-2">
            <button
              onClick={go('uploader')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeMainView === 'uploader'
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>📤</span>
                Upload BRD
              </div>
            </button>
            
            <button
              onClick={go('artifacts')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeMainView === 'artifacts'
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>⚡</span>
                Generated SDLC Artifacts
              </div>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
