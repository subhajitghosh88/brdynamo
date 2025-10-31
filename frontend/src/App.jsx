import React, { useState, useEffect } from "react";
import FileUploader from "./components/FileUploader";
import CodeViewer from "./components/CodeViewer";
import Header from "./components/Header";
import { AnimatePresence, motion } from 'framer-motion'

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeView, setActiveView] = useState('uploader'); // 'uploader' | 'generated'
  const [flash, setFlash] = useState(false);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    // after upload, show generated files
    setActiveView('generated');
  };

  // Flash highlight when switching views
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1000);
    return () => clearTimeout(t);
  }, [activeView]);

  const handleNavigate = (target) => {
    if (target === 'uploader') setActiveView('uploader');
    if (target === 'generated') setActiveView('generated');
    // scroll to top of main content for clarity
    const main = document.querySelector('.max-w-5xl');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 py-10 scroll-smooth">
      <Header onNavigate={handleNavigate} />

  <div className="max-w-5xl mx-auto space-y-10 px-6">
        {/* Hero / Landing */}
        <section className="text-center mt-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900">BRDynamo</h1>
          <p className="mt-3 text-lg text-slate-600">Convert Business Requirement Documents into scaffolded project code using a generative model.</p>
          {/* CTA removed per request */}
        </section>

        {/* Only render one of the two sections at a time with animation and a short flash highlight */}
        <div className={flash ? 'flash-highlight' : ''}>
          <AnimatePresence mode="wait" initial={false}>
            {activeView === 'uploader' && (
              <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <FileUploader
                  uploadUrl={import.meta.env.VITE_UPLOAD_URL || "http://localhost:8000/upload"}
                  onUploadComplete={handleUploadComplete}
                />
              </motion.div>
            )}

            {activeView === 'generated' && (
              <motion.div key="generated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <CodeViewer refreshTrigger={refreshTrigger} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
