import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

const DiagramViewer = () => {
    const [diagrams, setDiagrams] = useState({});
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDiagram, setSelectedDiagram] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Download utility function
    const downloadDiagram = (diagramPath, diagramData, format) => {
        if (!diagramData) return;

        const { type, content } = diagramData;
        const fileName = diagramPath.split('/').pop().replace('.puml', `.${format}`);

        let blob;
        let mimeType;

        if (format === 'svg' && type === 'svg') {
            blob = new Blob([content], { type: 'image/svg+xml' });
            mimeType = 'image/svg+xml';
        } else if (format === 'png' && type === 'png') {
            // Convert base64 to blob
            const byteCharacters = atob(content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: 'image/png' });
            mimeType = 'image/png';
        } else if (format === 'puml' && type === 'plantuml') {
            blob = new Blob([content], { type: 'text/plain' });
            mimeType = 'text/plain';
        } else {
            console.error('Invalid format for download:', format, type);
            return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const fetchDiagrams = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/diagrams`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            
            setDiagrams(data.diagrams || {});
            setSummary(data.summary || {});
            
            // Auto-select first diagram if available
            const diagramPaths = Object.keys(data.diagrams || {});
            if (diagramPaths.length > 0 && !selectedDiagram) {
                setSelectedDiagram(diagramPaths[0]);
            }
        } catch (err) {
            console.error("Error fetching diagrams:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        
        const loadDiagrams = async () => {
            if (!isMounted) return;
            await fetchDiagrams();
        };
        
        loadDiagrams();
        
        return () => {
            isMounted = false;
        };
    }, []);

    // Handle keyboard events for modal
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                setIsModalOpen(false);
            }
        };

        if (isModalOpen) {
            document.addEventListener('keydown', handleKeyPress);
            // Prevent body scrolling when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
            document.body.style.overflow = 'unset';
        };
    }, [isModalOpen]);

    const renderDiagramContent = (diagramPath, diagramData) => {
        if (!diagramData) return null;

        const { type, content, format } = diagramData;

        switch (type) {
            case 'svg':
                return (
                    <div 
                        className="diagram-svg"
                        dangerouslySetInnerHTML={{ __html: content }}
                        style={{ maxWidth: '100%', overflow: 'auto' }}
                    />
                );
            
            case 'png':
                return (
                    <img 
                        src={`data:image/png;base64,${content}`}
                        alt={diagramPath}
                        style={{ maxWidth: '100%', height: 'auto' }}
                    />
                );
            
            case 'plantuml':
                return (
                    <div className="diagram-source">
                        <h4>PlantUML Source</h4>
                        <pre style={{
                            background: '#f5f5f5',
                            padding: '16px',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                        }}>
                            {content}
                        </pre>
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            <a href="https://kroki.io/" target="_blank" rel="noopener noreferrer">
                                Render online at Kroki.io
                            </a>
                        </div>
                    </div>
                );
            
            case 'markdown':
                return (
                    <div className="diagram-markdown">
                        <pre style={{
                            background: '#f9f9f9',
                            padding: '16px',
                            borderRadius: '4px',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}>
                            {content}
                        </pre>
                    </div>
                );
            
            default:
                return (
                    <div className="diagram-unknown">
                        <p>Unknown diagram type: {type}</p>
                        <pre style={{ fontSize: '12px', color: '#666' }}>
                            {content}
                        </pre>
                    </div>
                );
        }
    };

    const getDiagramsByType = (targetType) => {
        return Object.entries(diagrams).filter(([path, data]) => 
            data.type === targetType
        );
    };

    const DiagramGallery = () => {
        // Get unique diagram names (without extensions)
        const diagramNames = new Set();
        Object.keys(diagrams).forEach(path => {
            const fileName = path.split('/').pop();
            if (fileName && (fileName.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.puml'))) {
                const baseName = fileName.replace(/\.(svg|png|puml)$/, '');
                if (baseName !== 'README') {
                    diagramNames.add(baseName);
                }
            }
        });

        const handleDiagramClick = (diagramName, displayPath, displayData) => {
            setSelectedDiagram({ name: diagramName, path: displayPath, data: displayData });
            setIsModalOpen(true);
        };

        return (
            <div className="diagram-gallery">
                {diagramNames.size > 0 && (
                    <div className="diagram-section">
                        <h3 style={{ marginBottom: '24px', fontSize: '24px', color: '#1f2937' }}>
                            Architecture Diagrams
                        </h3>
                        
                        {/* Grid Layout */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '24px',
                            marginBottom: '32px'
                        }}>
                            {Array.from(diagramNames).map(diagramName => {
                                // Find SVG, PNG, and PlantUML versions
                                const svgEntry = Object.entries(diagrams).find(([path]) => 
                                    path.endsWith(`${diagramName}.svg`)
                                );
                                const pngEntry = Object.entries(diagrams).find(([path]) => 
                                    path.endsWith(`${diagramName}.png`)
                                );
                                const pumlEntry = Object.entries(diagrams).find(([path]) => 
                                    path.endsWith(`${diagramName}.puml`)
                                );
                                
                                // Prefer SVG, fallback to PNG
                                const [displayPath, displayData] = svgEntry || pngEntry || [null, null];
                                
                                if (!displayData) return null;

                                const titleFormatted = diagramName
                                    .replace(/-/g, ' ')
                                    .replace(/\b\w/g, l => l.toUpperCase());

                                return (
                                    <div 
                                        key={diagramName} 
                                        className="diagram-card" 
                                        style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '12px',
                                            padding: '20px',
                                            backgroundColor: 'white',
                                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                transform: 'translateY(-2px)'
                                            }
                                        }}
                                        onClick={() => handleDiagramClick(diagramName, displayPath, displayData)}
                                        onMouseEnter={(e) => {
                                            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                            e.target.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                            e.target.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            marginBottom: '16px'
                                        }}>
                                            <h4 style={{ 
                                                margin: 0, 
                                                fontSize: '18px',
                                                fontWeight: '600',
                                                color: '#1f2937'
                                            }}>
                                                {titleFormatted}
                                            </h4>
                                            <div style={{ 
                                                fontSize: '12px', 
                                                color: '#6b7280',
                                                backgroundColor: '#f3f4f6',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontWeight: '500'
                                            }}>
                                                {svgEntry ? 'SVG' : 'PNG'}
                                            </div>
                                        </div>
                                        
                                        {/* Thumbnail */}
                                        <div style={{ 
                                            height: '200px',
                                            overflow: 'hidden',
                                            borderRadius: '8px',
                                            backgroundColor: '#f9fafb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative'
                                        }}>
                                            <div style={{ 
                                                transform: 'scale(0.3)',
                                                transformOrigin: 'center center',
                                                maxWidth: '333%',
                                                maxHeight: '333%'
                                            }}>
                                                {renderDiagramContent(displayPath, displayData)}
                                            </div>
                                            
                                            {/* Click overlay */}
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: 0,
                                                transition: 'opacity 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                                            onMouseLeave={(e) => e.target.style.opacity = '0'}
                                            >
                                                <div style={{
                                                    backgroundColor: 'white',
                                                    padding: '8px 16px',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    color: '#374151',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                                }}>
                                                    Click to enlarge
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Status indicators */}
                                        <div style={{ 
                                            marginTop: '12px', 
                                            fontSize: '12px', 
                                            color: '#6b7280',
                                            display: 'flex',
                                            gap: '12px',
                                            alignItems: 'center'
                                        }}>
                                            {svgEntry && (
                                                <span style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px',
                                                    color: '#059669'
                                                }}>
                                                    <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                                                    SVG
                                                </span>
                                            )}
                                            {pngEntry && (
                                                <span style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px',
                                                    color: '#059669'
                                                }}>
                                                    <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                                                    PNG
                                                </span>
                                            )}
                                            {!pngEntry && svgEntry && (
                                                <span style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px',
                                                    color: '#6b7280',
                                                    fontSize: '0.8em'
                                                }} title="PNG generation temporarily unavailable due to server resources. SVG version is fully functional.">
                                                    <span style={{ width: '6px', height: '6px', backgroundColor: '#9ca3af', borderRadius: '50%' }}></span>
                                                    SVG only
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Download buttons */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            marginTop: '12px',
                                            flexWrap: 'wrap'
                                        }}>
                                            {svgEntry && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadDiagram(displayPath, svgEntry[1], 'svg');
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'background-color 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
                                                    title="Download SVG file"
                                                >
                                                    📥 SVG
                                                </button>
                                            )}
                                            {pngEntry && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadDiagram(displayPath, pngEntry[1], 'png');
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'background-color 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                                                    title="Download PNG file"
                                                >
                                                    📥 PNG
                                                </button>
                                            )}
                                            {pumlEntry && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadDiagram(displayPath, pumlEntry[1], 'puml');
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        backgroundColor: '#6b7280',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'background-color 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
                                                    title="Download PlantUML source file"
                                                >
                                                    📥 Source
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div>Loading diagrams...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px' }}>
                <div style={{ 
                    background: '#fee', 
                    color: '#c33', 
                    padding: '16px', 
                    borderRadius: '4px',
                    marginBottom: '16px'
                }}>
                    <strong>Error loading diagrams:</strong> {error}
                </div>
                <button 
                    onClick={fetchDiagrams}
                    style={{
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const diagramCount = Object.keys(diagrams).length;

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
            <div style={{ marginBottom: '32px' }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '24px'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '28px',
                        fontWeight: '700',
                        color: '#1f2937'
                    }}>
                        Architecture Diagrams
                    </h2>
                    
                    <button 
                        onClick={fetchDiagrams}
                        disabled={loading}
                        style={{
                            background: loading ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'background-color 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) e.target.style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) e.target.style.backgroundColor = '#3b82f6';
                        }}
                    >
                        <span style={{
                            animation: loading ? 'spin 1s linear infinite' : 'none',
                            display: 'inline-block'
                        }}>
                            {loading ? '⟳' : '↻'}
                        </span>
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                <div style={{ 
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    padding: '20px', 
                    borderRadius: '12px',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{
                        fontSize: '24px',
                        opacity: 0.8
                    }}>
                        📊
                    </div>
                    <div>
                        <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#0c4a6e',
                            marginBottom: '4px'
                        }}>
                            {summary.total_diagrams || 0} diagram files generated
                        </div>
                        <div style={{
                            fontSize: '14px',
                            color: '#0369a1',
                            display: 'flex',
                            gap: '16px'
                        }}>
                            <span>{summary.svg_files || 0} SVG files</span>
                            <span>{summary.png_files || 0} PNG files</span>
                            <span>{summary.puml_files || 0} PlantUML source files</span>
                        </div>
                        {summary.png_files < summary.svg_files && summary.svg_files > 0 && (
                            <div style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                marginTop: '8px',
                                padding: '8px 12px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb'
                            }}>
                                ℹ️ Some PNG files may be temporarily unavailable due to server resources. All diagrams are available as high-quality SVG files.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {diagramCount === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 40px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '16px',
                    color: '#64748b',
                    border: '1px dashed #cbd5e1'
                }}>
                    <div style={{
                        fontSize: '48px',
                        marginBottom: '16px',
                        opacity: 0.5
                    }}>
                        📊
                    </div>
                    <h3 style={{ 
                        fontSize: '20px', 
                        fontWeight: '600', 
                        margin: '0 0 8px 0',
                        color: '#475569'
                    }}>
                        No diagrams available
                    </h3>
                    <p style={{ margin: 0, fontSize: '16px' }}>
                        Upload and process a BRD file to generate architecture diagrams.
                    </p>
                </div>
            ) : (
                <>
                    <DiagramGallery />
                    
                    {/* Zoom Modal */}
                    {isModalOpen && selectedDiagram && (
                        <div 
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                zIndex: 1000,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '20px'
                            }}
                            onClick={() => setIsModalOpen(false)}
                        >
                            <div 
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    maxWidth: '90vw',
                                    maxHeight: '90vh',
                                    overflow: 'auto',
                                    position: 'relative'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    position: 'sticky',
                                    top: 0,
                                    backgroundColor: 'white',
                                    zIndex: 1
                                }}>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: '20px',
                                        fontWeight: '600',
                                        color: '#1f2937'
                                    }}>
                                        {selectedDiagram.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </h2>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '6px',
                                            color: '#6b7280'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        ×
                                    </button>
                                </div>
                                
                                {/* Modal Download Buttons */}
                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    justifyContent: 'center',
                                    padding: '0 24px',
                                    borderBottom: '1px solid #e5e7eb',
                                    paddingBottom: '16px'
                                }}>
                                    {(() => {
                                        const { path, data } = selectedDiagram;
                                        const entries = Object.entries(diagrams)
                                            .filter(([diagramPath]) => {
                                                const normalizedPath = diagramPath.replace(/\\/g, '/');
                                                const normalizedSelectedPath = path.replace(/\\/g, '/');
                                                return normalizedPath.includes(normalizedSelectedPath.split('.')[0]);
                                            });

                                        const svgEntry = entries.find(([, data]) => data.type === 'svg')?.[1];
                                        const pngEntry = entries.find(([, data]) => data.type === 'png')?.[1];
                                        const pumlEntry = entries.find(([, data]) => data.type === 'plantuml')?.[1];

                                        return (
                                            <>
                                                {svgEntry && (
                                                    <button
                                                        onClick={() => downloadDiagram(path, svgEntry, 'svg')}
                                                        style={{
                                                            padding: '8px 16px',
                                                            fontSize: '14px',
                                                            backgroundColor: '#3b82f6',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'background-color 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
                                                    >
                                                        📥 Download SVG
                                                    </button>
                                                )}
                                                {pngEntry && (
                                                    <button
                                                        onClick={() => downloadDiagram(path, pngEntry, 'png')}
                                                        style={{
                                                            padding: '8px 16px',
                                                            fontSize: '14px',
                                                            backgroundColor: '#10b981',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'background-color 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                                                    >
                                                        📥 Download PNG
                                                    </button>
                                                )}
                                                {pumlEntry && (
                                                    <button
                                                        onClick={() => downloadDiagram(path, pumlEntry, 'puml')}
                                                        style={{
                                                            padding: '8px 16px',
                                                            fontSize: '14px',
                                                            backgroundColor: '#6b7280',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'background-color 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
                                                    >
                                                        📥 Download Source
                                                    </button>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                
                                {/* Modal Content */}
                                <div style={{
                                    padding: '24px',
                                    textAlign: 'center'
                                }}>
                                    {renderDiagramContent(selectedDiagram.path, selectedDiagram.data)}
                                </div>
                                
                                {/* Modal Footer */}
                                <div style={{
                                    padding: '16px 24px',
                                    borderTop: '1px solid #e5e7eb',
                                    backgroundColor: '#f9fafb',
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    textAlign: 'center'
                                }}>
                                    Press Esc or click outside to close
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DiagramViewer;