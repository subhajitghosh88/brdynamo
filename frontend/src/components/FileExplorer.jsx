import React, { useState, useEffect } from "react";

// Enhanced file explorer with modern styling
export default function FileExplorer({ files = {}, onFileSelect, selected }) {
    const [tree, setTree] = useState(null);
    // set of opened folder fullPaths
    const [openSet, setOpenSet] = useState(new Set());
    const [isBuilding, setIsBuilding] = useState(false);

    useEffect(() => {
        console.log("FileExplorer received files:", files);
        console.log("Number of files:", Object.keys(files || {}).length);
        console.log("File paths:", Object.keys(files || {}));
        
        setIsBuilding(true);
        
        const buildFromPaths = (filesObj) => {
            const root = { name: "", children: {}, isRoot: true };

            Object.keys(filesObj || {}).forEach((path) => {
                const parts = path.split("/").filter(Boolean);
                let node = root;
                parts.forEach((part, idx) => {
                    if (!node.children[part]) {
                        node.children[part] = { name: part, children: {}, isFile: idx === parts.length - 1 };
                    }
                    node = node.children[part];
                });
                // Attach full path to leaf so selection can pass it back
                node.fullPath = path;
            });

            // convert children maps to arrays recursively and assign fullPath for every node
            const mapToArray = (n, prefix = []) => {
                const currentPath = prefix.length ? prefix.join('/') : '';
                const out = { name: n.name, isFile: !!n.isFile, fullPath: n.fullPath || currentPath, isRoot: !!n.isRoot };
                const childrenKeys = Object.keys(n.children || {});
                out.children = childrenKeys.length ? childrenKeys.map((k) => mapToArray(n.children[k], currentPath ? [...prefix, k] : [k])) : [];
                return out;
            };

            return mapToArray(root);
        };

        const generated = buildFromPaths(files);
        console.log("Generated explorer tree:", generated);
        console.log("Tree children count:", generated?.children?.length || 0);
        console.log("Tree structure sample:", generated?.children?.slice(0, 3));
        if (!generated?.children || generated.children.length === 0) {
            console.error("Tree building produced no children! Input files:", Object.keys(files || {}));
        }
        setTree(generated);
        setIsBuilding(false);
    }, [files]);

    // expand to the selected file's ancestors when selected changes
    useEffect(() => {
        if (!selected) return;
        const parts = selected.split('/').filter(Boolean);
        const acc = [];
        const newSet = new Set(openSet);
        for (let i = 0; i < parts.length - 1; i++) {
            acc.push(parts[i]);
            newSet.add(acc.join('/'));
        }
        setOpenSet(newSet);
    }, [selected]);

    const getFileIcon = (fileName) => {
        if (!fileName) return "📁";
        const ext = fileName.split('.').pop()?.toLowerCase();
        const iconMap = {
            'java': '☕',
            'js': '📄',
            'jsx': '⚛️',
            'ts': '📘',
            'tsx': '📘',
            'py': '🐍',
            'html': '🌐',
            'css': '🎨',
            'json': '📊',
            'xml': '📋',
            'md': '📝',
            'txt': '📝',
            'yml': '⚙️',
            'yaml': '⚙️',
            'properties': '⚙️',
            'gradle': '🛠️',
            'pom': '📦'
        };
        return iconMap[ext] || '📄';
    };

    const TreeNode = ({ node, selected }) => {
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const isOpen = node.fullPath ? openSet.has(node.fullPath) : false;
        const isSelected = selected === node.fullPath;

        const toggleOpen = () => {
            const next = new Set(openSet);
            if (isOpen) next.delete(node.fullPath);
            else next.add(node.fullPath);
            setOpenSet(next);
        };

        return (
            <div className={`${node.isRoot ? '' : 'ml-3'}`}>
                {!node.isRoot && (
                    <div className="flex items-center group">
                        {hasChildren ? (
                            <button 
                                onClick={toggleOpen}
                                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all duration-150"
                                aria-label="Toggle folder"
                            >
                                <svg 
                                    className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                >
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                        ) : (
                            <div className="w-5 h-5"></div>
                        )}
                        
                        <div
                            onClick={() => {
                                if (node.isFile && node.fullPath) {
                                    onFileSelect && onFileSelect(node.fullPath);
                                }
                            }}
                            className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer transition-all duration-150 min-w-0 ${
                                isSelected 
                                    ? 'bg-yellow-100 text-yellow-800 border-l-2 border-yellow-400 shadow-sm' 
                                    : node.isFile 
                                        ? 'hover:bg-blue-50 text-gray-700 hover:text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-800 font-medium'
                            } ${node.isFile ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <span className="mr-1 text-sm flex-shrink-0">
                                {node.isFile ? getFileIcon(node.name) : "📁"}
                            </span>
                            <span className="whitespace-nowrap">{node.name}</span>
                        </div>
                    </div>
                )}

                {hasChildren && isOpen && (
                    <div style={{ marginLeft: 8 }}>
                        {node.children
                            .sort((a, b) => {
                                // Folders first, then files
                                if (!a.isFile && b.isFile) return -1;
                                if (a.isFile && !b.isFile) return 1;
                                // Then alphabetical within same type
                                return a.name.localeCompare(b.name);
                            })
                            .map((c) => (
                                <TreeNode key={c.fullPath || c.name} node={c} selected={selected} />
                            ))}
                    </div>
                )}
            </div>
        );
    };

    if (isBuilding) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                Building file tree...
            </div>
        );
    }

    if (!tree || !tree.children || tree.children.length === 0) {
        const fileCount = Object.keys(files || {}).length;
        if (fileCount > 0) {
            console.error("Tree building failed but files exist:", files);
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-red-800 font-semibold mb-2">⚠️ Tree building failed!</div>
                    <div className="text-red-700 text-sm mb-3">Files received: {fileCount}</div>
                    <div className="bg-white rounded border max-h-48 overflow-y-auto">
                        {Object.keys(files).map(path => (
                            <div 
                                key={path} 
                                onClick={() => onFileSelect && onFileSelect(path)} 
                                className="px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                            >
                                📄 {path}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm">No files available to display</p>
            </div>
        );
    }

    const expandAll = () => {
        const all = new Set();
        const walk = (n, prefix = []) => {
            const fp = n.fullPath || prefix.join('/');
            if (n.children && n.children.length) {
                if (fp) all.add(fp);
                n.children.forEach((c) => walk(c, fp ? fp.split('/') : [...prefix, n.name]));
            }
        };
        tree.children.forEach((c) => walk(c, []));
        setOpenSet(all);
    };

    const collapseAll = () => setOpenSet(new Set());

    return (
        <div>
            {/* Controls */}
            <div className="flex justify-end gap-2 mb-3">
                <button 
                    onClick={expandAll} 
                    className="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 transition-colors duration-150"
                    title="Expand all folders"
                >
                    Expand All
                </button>
                <button 
                    onClick={collapseAll} 
                    className="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 transition-colors duration-150"
                    title="Collapse all folders"
                >
                    Collapse All
                </button>
            </div>

            {/* File tree with horizontal scroll */}
            <div className="overflow-x-auto overflow-y-auto max-h-[32rem]">
                <div className="min-w-max">
                    {tree.children
                        .sort((a, b) => {
                            // Folders first, then files
                            if (!a.isFile && b.isFile) return -1;
                            if (a.isFile && !b.isFile) return 1;
                            // Then alphabetical within same type
                            return a.name.localeCompare(b.name);
                        })
                        .map((child) => (
                            <TreeNode key={child.fullPath || child.name} node={child} selected={selected} />
                        ))}
                </div>
            </div>
        </div>
    );
}