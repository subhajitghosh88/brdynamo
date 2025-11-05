import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

const JiraViewer = () => {
    const [jiraFiles, setJiraFiles] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchJiraFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/jira-stories`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            
            setJiraFiles(data.files || {});
            
            // Auto-select first file if available
            const fileNames = Object.keys(data.files || {});
            if (fileNames.length > 0) {
                setSelectedFile(fileNames[0]);
            }
        } catch (err) {
            console.error("Error fetching JIRA files:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJiraFiles();
    }, []);

    const downloadFile = (fileName, content) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const renderContent = (fileName, content) => {
        if (fileName.endsWith('.md')) {
            return (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 max-h-96 overflow-auto">
                    <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                        {content}
                    </pre>
                </div>
            );
        } else if (fileName.endsWith('.csv')) {
            // Parse and display CSV in a table
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length === 0) return (
                <div className="text-center py-8 text-gray-500">
                    <div className="text-2xl mb-2">📊</div>
                    <p>Empty CSV file</p>
                </div>
            );
            
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const rows = lines.slice(1).map(line => 
                line.split(',').map(cell => cell.replace(/"/g, '').trim())
            );

            return (
                <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                {headers.map((header, idx) => (
                                    <th key={idx} className="px-4 py-3 text-left border-b border-gray-200 font-semibold text-gray-800 text-sm">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-4 py-3 text-gray-700 text-sm border-b border-gray-100 last:border-b-0">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        } else {
            return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-96 overflow-auto">
                    <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                        {content}
                    </pre>
                </div>
            );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                <span className="text-gray-600">Loading JIRA stories...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
                <div className="flex items-center mb-3">
                    <span className="text-xl mr-2">❌</span>
                    <strong>Error loading JIRA stories:</strong>
                </div>
                <p className="mb-4 text-red-700">{error}</p>
                <button
                    onClick={fetchJiraFiles}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-150 text-sm font-medium"
                >
                    🔄 Retry
                </button>
            </div>
        );
    }

    const fileNames = Object.keys(jiraFiles);

    if (fileNames.length === 0) {
        return (
            <div className="text-center py-16 px-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-200">
                <div className="text-6xl mb-6 opacity-60">
                    📋
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    No JIRA Stories Found
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Upload and generate a BRD first to create JIRA stories and project management artifacts.
                </p>
                <div className="text-sm text-gray-500 bg-white/50 rounded-lg px-4 py-3 inline-block">
                    💡 JIRA stories will be automatically generated when you process a Business Requirement Document
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                            <span className="mr-3 text-2xl">📊</span>
                            JIRA Stories & Project Management
                        </h3>
                        <p className="text-gray-600 text-sm">
                            Generated project management artifacts and JIRA story templates
                        </p>
                    </div>
                    <button
                        onClick={fetchJiraFiles}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-150 text-sm font-medium flex items-center gap-2"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* File Tabs */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                        <span className="mr-2">📁</span>
                        Available Files ({fileNames.length})
                    </h4>
                </div>
                <div className="flex flex-wrap gap-1 p-2 bg-gray-50">
                    {fileNames.map(fileName => (
                        <button
                            key={fileName}
                            onClick={() => setSelectedFile(fileName)}
                            className={`
                                px-3 py-2 text-sm font-medium rounded-md transition-all duration-150
                                ${selectedFile === fileName 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200'
                                }
                            `}
                        >
                            {fileName.replace(/\.(md|csv|txt)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                    ))}
                </div>
            </div>

            {/* File Content */}
            {selectedFile && jiraFiles[selectedFile] && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="text-lg mr-2">📄</span>
                                <h4 className="text-lg font-semibold text-gray-800">
                                    {selectedFile}
                                </h4>
                            </div>
                            <button
                                onClick={() => downloadFile(selectedFile, jiraFiles[selectedFile])}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-150 text-sm font-medium flex items-center gap-2 shadow-sm"
                            >
                                📥 Download
                            </button>
                        </div>
                    </div>
                    <div className="p-6">
                        {renderContent(selectedFile, jiraFiles[selectedFile])}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JiraViewer;