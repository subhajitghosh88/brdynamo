import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

/**
 * Props:
 *  - uploadUrl (string) default 'http://localhost:8000/upload'
 */
export default function FileUploader({ uploadUrl = "http://localhost:8000/upload" }) {
  const [files, setFiles] = useState([]); // { file, id, preview, progress, status }
  const inputRef = useRef(null);

  function handleFiles(selectedFiles) {
    const arr = Array.from(selectedFiles).map((f) => ({
      file: f,
      id: `${f.name}-${f.size}-${f.lastModified}`,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      progress: 0,
      status: "ready",
    }));
    setFiles((prev) => [...prev, ...arr]);
  }

  function onDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function openFileDialog() {
    inputRef.current?.click();
  }

  async function uploadSingle(fileObj) {
    const formData = new FormData();
    formData.append("file", fileObj.file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setFiles((prev) => prev.map((p) => (p.id === fileObj.id ? { ...p, progress: percent } : p)));
        }
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            setFiles((prev) => prev.map((p) => (p.id === fileObj.id ? { ...p, status: "done", progress: 100 } : p)));
            resolve(xhr.responseText);
          } else {
            setFiles((prev) => prev.map((p) => (p.id === fileObj.id ? { ...p, status: "error" } : p)));
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      };

      xhr.send(formData);
      setFiles((prev) => prev.map((p) => (p.id === fileObj.id ? { ...p, status: "uploading" } : p)));
    });
  }

  async function uploadAll() {
    const ready = files.filter((f) => f.status === "ready" || f.status === "error");
    for (const f of ready) {
      try {
        // sequential to keep UX simple; parallelize if you want concurrency
        // eslint-disable-next-line no-await-in-loop
        await uploadSingle(f);
      } catch (err) {
        console.error("Upload error", err);
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-2">Upload files</h2>
        <p className="text-sm text-slate-500 mb-4">Drag & drop files here or click to select. Image previews supported.</p>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          role="button"
          tabIndex={0}
          onClick={openFileDialog}
          onKeyDown={(e) => e.key === "Enter" && openFileDialog()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-300 transition"
        >
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <div className="flex flex-col items-center justify-center space-y-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <div className="text-sm text-slate-600">Drop files here or click to browse</div>
            <div className="text-xs text-slate-400">Supported: any — server will validate size & type</div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {files.length === 0 ? (
            <div className="text-sm text-slate-500">No files selected yet.</div>
          ) : (
            files.map((f) => (
              <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 rounded-lg p-3 flex items-center gap-4">
                {f.preview ? <img src={f.preview} alt={f.file.name} className="w-16 h-16 object-cover rounded-md" /> : <div className="w-16 h-16 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-xs">{f.file.type || "FILE"}</div>}

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.file.name}</div>
                  <div className="text-xs text-slate-500">{(f.file.size / 1024 / 1024).toFixed(2)} MB</div>

                  <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div style={{ width: `${f.progress}%` }} className={`h-full rounded-full transition-all ${f.status === "error" ? "bg-red-400" : "bg-sky-500"}`} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {f.status === "done" ? <span className="text-green-600 text-sm">Done</span> : null}
                  {f.status === "uploading" ? <span className="text-slate-500 text-sm">Uploading...</span> : null}
                  {f.status === "error" ? <span className="text-red-500 text-sm">Error</span> : null}

                  <button onClick={() => removeFile(f.id)} className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200">Remove</button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">
              Add files
            </button>
            <button onClick={uploadAll} className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:opacity-95">
              Upload
            </button>
          </div>

          <div className="text-sm text-slate-500">
            Server: <span className="font-mono">{uploadUrl}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
