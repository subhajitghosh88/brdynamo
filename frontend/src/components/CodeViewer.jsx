import React, { useEffect, useState, useRef } from "react";
import FileExplorer from "./FileExplorer";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function CodeViewer({ refreshTrigger, isBRDUploaded }) {
    const [files, setFiles] = useState({});
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadProcessing, setDownloadProcessing] = useState(false);
    const [message, setMessage] = useState(null);
    const [lastFetch, setLastFetch] = useState({ files: 0 });
    const codeRef = useRef(null);

    const getLanguageFromFilename = (filename) => {
        if (!filename || typeof filename !== "string") return "text";
        const base = filename.split("/").pop();
        const parts = base.split(".");
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
        switch (ext) {
            case "java":
                return "java";
            case "xml":
                return "markup"; // prism uses markup for xml/html
            case "html":
            case "htm":
                return "markup";
            case "js":
                return "javascript";
            case "jsx":
                return "jsx";
            case "ts":
                return "typescript";
            case "tsx":
                return "tsx";
            case "py":
                return "python";
            case "json":
                return "json";
            case "css":
                return "css";
            case "md":
                return "markdown";
            case "yml":
            case "yaml":
                return "yaml";
            default:
                return "text";
        }
    };

    // Attempt to run Prism highlighting if available after selected changes
    useEffect(() => {
        if (!selected) return;
        // wait for DOM update
        setTimeout(() => {
            try {
                const codeEl = codeRef.current && codeRef.current.querySelector && codeRef.current.querySelector("code");
                if (window.Prism && codeEl) {
                    window.Prism.highlightElement(codeEl);
                } else if (window.hljs && codeEl) {
                    // highlight.js expects the <code> element to have the language class or to auto-detect
                    window.hljs.highlightElement(codeEl);
                }
            } catch (e) {
                console.warn("Syntax highlight failed", e);
            }
        }, 50);
    }, [selected, files]);

    const fetchFiles = async (force = false) => {
        const now = Date.now();
        
        // Skip if fetched recently (within 5 seconds) unless forced
        if (!force && (now - lastFetch.files) < 5000) {
            console.log("Skipping files fetch - too recent");
            return;
        }
        
        console.log("Fetching files...");
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/generated-files`, {
                method: "GET",
                headers: { "Cache-Control": "no-cache" },
            });
            if (!res.ok) throw new Error("Failed to fetch generated files");
            const data = await res.json();
            console.log("Files fetched successfully", data);
            console.log("API returned file count:", Object.keys(data || {}).length);
            console.log("Sample file paths:", Object.keys(data || {}).slice(0, 5));
            
            // Clean fenced codeblocks (```java, ```xml, etc.) that may be present in generated content
            const clean = (s) => {
                if (typeof s !== "string") return s;
                // remove leading ```lang\n or ```\n
                s = s.replace(/^```[^\n]*\r?\n/, "");
                // remove trailing ``` on its own line
                s = s.replace(/\r?\n```\s*$/, "");
                return s;
            };
            const cleaned = {};
            Object.keys(data || {}).forEach((k) => {
                cleaned[k] = clean(data[k]);
            });
            setFiles(cleaned);
            const keys = Object.keys(data || {});
            setSelected(keys.length ? keys[0] : null);
            
            setLastFetch(prev => ({ ...prev, files: now }));
        } catch (err) {
            console.error("Error fetching files", err);
            console.error("API URL:", `${API_BASE}/generated-files`);
            console.error("Error details:", {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            setFiles({});
            setSelected(null);
            setMessage({ type: "error", text: `Failed to load generated files: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };



    // Initial load only - no auto-refresh (removed as it was irritating)
    useEffect(() => {
        // Initial fetch only (one-time)
        fetchFiles();
        console.log("Initial files fetch completed - no auto-refresh enabled");
    }, []); // Empty dependency array - runs only once on mount
    
    // Separate effect for refreshTrigger (from parent component)
    useEffect(() => {
        if (refreshTrigger) {
            console.log("External refresh triggered", refreshTrigger);
            fetchFiles(true); // Force refresh when triggered externally
        }
    }, [refreshTrigger]);

    const downloadZip = async () => {
        setDownloadProcessing(true);
        try {
            const res = await fetch(`${API_BASE}/generated-code`);
            if (!res.ok) throw new Error("Failed to download zip");
            const blob = await res.blob();
            const contentDisposition = res.headers.get("Content-Disposition") || "";
            let filename = "generated_package.zip";
            const match = contentDisposition.match(/filename\*=UTF-8''(.+)|filename="(.+)"/);
            if (match) filename = decodeURIComponent(match[1] || match[2]);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setMessage({ type: "success", text: `Download started: ${filename}` });
        } catch (err) {
            console.error(err);
            setMessage({ type: "error", text: "Download failed: " + (err.message || "") });
        } finally {
            setDownloadProcessing(false);
        }
    };

    return (
        <div className="p-6">
            {/* Enhanced Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <span className="text-2xl">🗂️</span>
                        Generated Project Files
                    </h3>
                    <p className="text-slate-600 mt-1">Explore your generated source code and configuration files</p>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Stats Badge */}
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {loading ? "Loading..." : `${Object.keys(files).length} files`}
                    </div>
                    
                    {/* Action Buttons */}
                    <button 
                        onClick={() => fetchFiles(true)}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                            loading 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md transform hover:scale-105'
                        }`}
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    
                    <button 
                        onClick={downloadZip}
                        disabled={downloadProcessing}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                            downloadProcessing 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md transform hover:scale-105'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {downloadProcessing ? "Preparing..." : "Download ZIP"}
                    </button>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-lg border ${
                    message.type === "error" 
                        ? "bg-red-50 border-red-200 text-red-700" 
                        : "bg-green-50 border-green-200 text-green-700"
                } flex items-center gap-3`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        message.type === "error" ? "bg-red-500" : "bg-green-500"
                    }`}>
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            {message.type === "error" ? (
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            ) : (
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            )}
                        </svg>
                    </div>
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* Enhanced Main Content */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="flex flex-col lg:flex-row min-h-[600px]">
                    {/* Enhanced File Explorer Sidebar */}
                    <div className="lg:w-80 w-full border-r border-slate-200">
                        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                <span>📁</span>
                                Project Structure
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">Click any file to view content</p>
                        </div>
                        <div className="p-4">
                            <FileExplorer 
                                files={files} 
                                selected={selected} 
                                onFileSelect={(fileName) => setSelected(fileName)} 
                            />
                        </div>
                    </div>

                    {/* Enhanced Code Viewer */}
                    <div className="flex-1 flex flex-col">
                        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <span>📄</span>
                                    {selected ? selected.split('/').pop() : 'File Content'}
                                </h4>
                                {selected && (
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                            {getLanguageFromFilename(selected).toUpperCase()}
                                        </span>
                                        <span className="text-sm text-slate-500">
                                            {selected}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex-1 p-6">
                            {selected ? (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                    <pre 
                                        ref={codeRef} 
                                        className="overflow-x-auto overflow-y-auto p-4 text-sm leading-relaxed"
                                        style={{ 
                                            whiteSpace: "pre", 
                                            maxHeight: "450px"
                                        }}
                                    >
                                        <code className={`language-${getLanguageFromFilename(selected)}`}>
                                            {files[selected]}
                                        </code>
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                    <div className="text-6xl mb-4 opacity-50">📂</div>
                                    <h3 className="text-xl font-semibold text-slate-900 mb-2">No File Selected</h3>
                                    <p className="text-slate-600 max-w-md">
                                        Choose a file from the project structure on the left to view its contents. 
                                        You can explore generated source code, configuration files, and documentation.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
