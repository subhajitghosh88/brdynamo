import React, { useState, useEffect, useCallback } from "react";

// Simple dependency-free file explorer. It accepts a flat object `files` where keys
// are file paths (e.g. "src/main/java/com/example/Foo.java") and values are file contents.
// It builds a nested tree from the path segments and renders a collapsible nested list.
export default function FileExplorer({ files = {}, onFileSelect, selected }) {
    const [tree, setTree] = useState(null);
    // set of opened folder fullPaths
    const [openSet, setOpenSet] = useState(new Set());

    useEffect(() => {
        console.log("FileExplorer received files:", files);
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
        setTree(generated);
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

    const TreeNode = ({ node, selected }) => {
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;

        const isOpen = node.fullPath ? openSet.has(node.fullPath) : false;

        const toggleOpen = () => {
            const next = new Set(openSet);
            if (isOpen) next.delete(node.fullPath);
            else next.add(node.fullPath);
            setOpenSet(next);
        };

        return (
            <div style={{ marginLeft: node.isRoot ? 0 : 12 }}>
                {!node.isRoot && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {hasChildren ? (
                            <button aria-label="toggle" onClick={toggleOpen} style={{ width: 20, height: 20, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                                {isOpen ? "▾" : "▸"}
                            </button>
                        ) : (
                            <span style={{ display: "inline-block", width: 20 }} />
                        )}
                        <div
                            onClick={() => {
                                if (node.isFile && node.fullPath) onFileSelect && onFileSelect(node.fullPath);
                            }}
                            style={{
                                cursor: node.isFile ? "pointer" : "default",
                                color: node.isFile ? "#0ea5e9" : "#111",
                                backgroundColor: node.fullPath === selected ? "#fff7b2" : "transparent",
                                padding: node.fullPath === selected ? "2px 6px" : undefined,
                                borderRadius: node.fullPath === selected ? 4 : undefined,
                            }}
                        >
                            {node.name}
                        </div>
                    </div>
                )}

                {hasChildren && isOpen && (
                    <div style={{ marginLeft: 8 }}>
                        {node.children.map((c) => (
                            <TreeNode key={c.fullPath || c.name} node={c} selected={selected} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!tree || !tree.children || tree.children.length === 0) {
        return <div style={{ color: "#666", textAlign: "center" }}>No files available to display.</div>;
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                <button onClick={expandAll} className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200">Expand all</button>
                <button onClick={collapseAll} className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200">Collapse all</button>
            </div>

            <div style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, maxHeight: 520, overflowY: "auto" }}>
                {tree.children.map((child) => (
                    <TreeNode key={child.fullPath || child.name} node={child} selected={selected} />
                ))}
            </div>
        </div>
    );
}