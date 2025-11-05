import React, { useState, useEffect } from "react";
import FileUploader from "./components/FileUploader";
import CodeViewer from "./components/CodeViewer";
import DiagramViewer from "./components/DiagramViewer";
import JiraViewer from "./components/JiraViewer";
import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import { AnimatePresence, motion } from 'framer-motion'

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeMainView, setActiveMainView] = useState('uploader'); // 'uploader' | 'artifacts'
  const [activeSubView, setActiveSubView] = useState('generated'); // 'generated' | 'diagrams' | 'jira'
  const [flash, setFlash] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasArtifacts, setHasArtifacts] = useState(false);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    setIsGenerating(true);
    // after upload, show SDLC artifacts with generated files sub-tab
    setActiveMainView('artifacts');
    setActiveSubView('generated');
    
    // Simulate generation completion (replace with actual status check)
    setTimeout(() => {
      setIsGenerating(false);
      setHasArtifacts(true);
    }, 3000);
  };

  // Flash highlight when switching views
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1000);
    return () => clearTimeout(t);
  }, [activeMainView, activeSubView]);

  const handleNavigate = (target) => {
    if (target === 'uploader') {
      setActiveMainView('uploader');
    } else if (target === 'artifacts') {
      setActiveMainView('artifacts');
      // Default to generated files if no sub-view is set
      if (activeSubView === 'generated') setActiveSubView('generated');
    }
    // scroll to top of main content for clarity
    const main = document.querySelector('.max-w-6xl');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubNavigate = (subTarget) => {
    setActiveSubView(subTarget);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 scroll-smooth">
      <Header onNavigate={handleNavigate} activeMainView={activeMainView} />

      {/* Enhanced container with better spacing */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Enhanced Hero Section */}
        <section className="text-center mb-12 mt-8">
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">
            BRDynamo
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Transform Business Requirement Documents into complete SDLC artifacts using AI-powered code generation
          </p>
          
          {/* Status Indicator */}
          {isGenerating && (
            <div className="mt-6">
              <StatusIndicator 
                status="loading" 
                message="Generating SDLC artifacts..." 
                className="inline-flex"
              />
            </div>
          )}
        </section>

        {/* Breadcrumb Navigation */}
        {activeMainView === 'artifacts' && (
          <nav className="mb-6">
            <div className="flex items-center text-sm text-slate-500">
              <button 
                onClick={() => handleNavigate('uploader')} 
                className="hover:text-blue-600 transition-colors"
              >
                Upload BRD
              </button>
              <span className="mx-2">/</span>
              <span className="text-slate-900 font-medium">Generated SDLC Artifacts</span>
              <span className="mx-2">/</span>
              <span className="text-blue-600 capitalize">{activeSubView === 'generated' ? 'Generated Files' : activeSubView === 'diagrams' ? 'Architecture Diagrams' : 'JIRA Stories'}</span>
            </div>
          </nav>
        )}

        {/* Main Content */}
        <div className={`transition-all duration-300 ${flash ? 'ring-2 ring-blue-200 ring-opacity-50' : ''}`}>
          <AnimatePresence mode="wait" initial={false}>
            
            {/* Upload View */}
            {activeMainView === 'uploader' && (
              <motion.div 
                key="uploader" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }} 
                transition={{ duration: 0.4 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6">
                  <h2 className="text-2xl font-bold text-white">Upload Business Requirement Document</h2>
                  <p className="text-blue-100 mt-2">Upload your BRD to generate complete project scaffolding</p>
                </div>
                <div className="p-8">
                  <FileUploader
                    uploadUrl={import.meta.env.VITE_UPLOAD_URL || "http://localhost:8000/upload"}
                    onUploadComplete={handleUploadComplete}
                  />
                </div>
              </motion.div>
            )}

            {/* Artifacts View */}
            {activeMainView === 'artifacts' && (
              <motion.div 
                key="artifacts" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }} 
                transition={{ duration: 0.4 }}
              >
                {/* Enhanced Section Header */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900">Generated SDLC Artifacts</h2>
                      <p className="text-slate-600 mt-1">Explore your generated project components</p>
                    </div>
                    {hasArtifacts && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Ready
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Sub-Navigation */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: 'generated', label: 'Generated Files', icon: '📁', desc: 'Source code & configuration' },
                        { key: 'diagrams', label: 'Architecture Diagrams', icon: '📊', desc: 'Visual system architecture' },
                        { key: 'jira', label: 'JIRA Stories', icon: '📋', desc: 'Project management artifacts' }
                      ].map(({ key, label, icon, desc }) => (
                        <button
                          key={key}
                          onClick={() => handleSubNavigate(key)}
                          className={`group flex-1 min-w-0 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSubView === key
                              ? 'bg-blue-500 text-white shadow-md transform scale-105'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-lg">{icon}</span>
                            <div className="text-center">
                              <div className="font-semibold">{label}</div>
                              <div className={`text-xs mt-1 ${activeSubView === key ? 'text-blue-100' : 'text-slate-400'}`}>
                                {desc}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-Content with Enhanced Container */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 min-h-[600px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {activeSubView === 'generated' && (
                      <motion.div 
                        key="generated" 
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }} 
                        transition={{ duration: 0.3 }}
                      >
                        <CodeViewer refreshTrigger={refreshTrigger} />
                      </motion.div>
                    )}

                    {activeSubView === 'diagrams' && (
                      <motion.div 
                        key="diagrams" 
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }} 
                        transition={{ duration: 0.3 }}
                      >
                        <DiagramViewer />
                      </motion.div>
                    )}

                    {activeSubView === 'jira' && (
                      <motion.div 
                        key="jira" 
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }} 
                        transition={{ duration: 0.3 }}
                      >
                        <JiraViewer />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Enhanced Footer */}
        <footer className="text-center mt-16 py-8 border-t border-slate-200">
          <p className="text-slate-500 text-sm">
            BRDynamo - Accelerating software development through intelligent automation
          </p>
        </footer>
      </div>
    </div>
  );
}
