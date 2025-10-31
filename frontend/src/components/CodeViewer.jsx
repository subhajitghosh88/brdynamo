import React, { useEffect, useState, useRef } from "react";
import FileExplorer from "./FileExplorer";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function CodeViewer({ refreshTrigger, isBRDUploaded }) {
    const [files, setFiles] = useState({});
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadProcessing, setDownloadProcessing] = useState(false);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState("explorer"); // tabs: explorer | content | controls
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

    const fetchFiles = async () => {
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
            // switch to explorer automatically when files arrive
            if (keys.length) setActiveTab("explorer");
        } catch (err) {
            console.error("Error fetching files", err);
            setFiles({});
            setSelected(null);
            setMessage({ type: "error", text: "Failed to load generated files." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (refreshTrigger) {
            console.log("Refresh triggered", refreshTrigger);
            fetchFiles();
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {/* Controls row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={fetchFiles} style={{ padding: "8px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6 }}>Refresh</button>
                    <button onClick={downloadZip} disabled={downloadProcessing} style={{ padding: "8px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 6 }}>{downloadProcessing ? "Preparing…" : "Download Zip"}</button>
                </div>
                <div style={{ color: "#6b7280" }}>{loading ? "Loading files…" : Object.keys(files).length + " files"}</div>
            </div>

            {/* Message */}
            {message && (
                <div style={{ padding: "8px 12px", backgroundColor: message.type === "error" ? "#fee2e2" : "#d1fae5", color: message.type === "error" ? "#991b1b" : "#065f46", borderRadius: 6 }}>{message.text}</div>
            )}

            {/* Explorer and Content side-by-side */}
            <div style={{ display: "flex", gap: 16 }}>
                <div style={{ width: 360 }}>
                    <h4 style={{ marginTop: 0 }}>Generated Files</h4>
                        <FileExplorer files={files} selected={selected} onFileSelect={(fileName) => { setSelected(fileName); }} />
                </div>

                <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, minHeight: 400, backgroundColor: "#f9f9f9" }}>
                    <h4 style={{ marginTop: 0 }}>File Content</h4>
                    {selected ? (
                        <pre ref={codeRef} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", backgroundColor: "#fff", padding: "12px", borderRadius: "6px" }}>
                            <code className={`language-${getLanguageFromFilename(selected)}`}>
                                {files[selected]}
                            </code>
                        </pre>
                    ) : (
                        <div style={{ color: "#666" }}>Select a file from the explorer to view its content.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
