import React from 'react'

export default function Header({ onNavigate }) {
  const go = (target) => (e) => {
    e.preventDefault();
    if (onNavigate) onNavigate(target);
  };

  return (
    <header className="w-full bg-white/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-sky-600 flex items-center justify-center text-white font-bold">BD</div>
          <div>
            <div className="text-lg font-semibold">BRDynamo</div>
            <div className="text-xs text-slate-500">Generate code from BRDs</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
          <a href="#uploader" onClick={go('uploader')} className="hover:underline cursor-pointer">Upload BRD</a>
          <a href="#explorer" onClick={go('generated')} className="hover:underline cursor-pointer">Generated Files</a>
        </nav>
      </div>
    </header>
  );
}
