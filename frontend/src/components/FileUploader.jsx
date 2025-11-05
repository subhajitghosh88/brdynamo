import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

/**
 * Props:
 *  - uploadUrl (string) default 'http://localhost:8000/upload'
 */
export default function FileUploader({ uploadUrl = "http://localhost:8000/upload", onUploadComplete }) {
  const [files, setFiles] = useState([]); // { file, id, preview, progress, status }
  const inputRef = useRef(null);

  function handleFiles(selectedFiles) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/pdf', // .pdf
      'text/plain' // .txt
    ];
    
    const allowedExtensions = ['.docx', '.pdf', '.txt'];
    
    const arr = Array.from(selectedFiles)
      .filter((f) => {
        const extension = '.' + f.name.split('.').pop().toLowerCase();
        const isValidType = allowedTypes.includes(f.type) || allowedExtensions.includes(extension);
        
        if (!isValidType) {
          alert(`File "${f.name}" is not supported. Please upload DOCX, PDF, or TXT files only.`);
          return false;
        }
        return true;
      })
      .map((f) => ({
        file: f,
        id: `${f.name}-${f.size}-${f.lastModified}`,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        progress: 0,
        status: "ready",
      }));
    
    setFiles((prev) => [...prev, ...arr]);
    
    // Clear the input value to allow selecting the same file again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
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
    
    // Clear the input value to ensure same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function openFileDialog() {
    // Clear the input value before opening to ensure same file can be selected
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
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
    if (onUploadComplete) onUploadComplete();
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
          <input 
            ref={inputRef} 
            type="file" 
            multiple 
            className="hidden" 
            accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
            onChange={(e) => handleFiles(e.target.files)} 
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="text-4xl text-slate-400">📄</div>
            <div className="text-sm text-slate-600">Drop Business Requirement Documents here or click to browse</div>
            <div className="text-xs text-slate-400">Supported formats: DOCX, PDF, TXT</div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {files.length === 0 ? (
            <div className="text-sm text-slate-500">No files selected yet.</div>
          ) : (
            files.map((f) => {
              const getFileIcon = (fileName, fileType) => {
                const extension = fileName.split('.').pop().toLowerCase();
                if (extension === 'pdf' || fileType === 'application/pdf') return '📄';
                if (extension === 'docx' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '📝';
                if (extension === 'txt' || fileType === 'text/plain') return '📄';
                return '📄';
              };

              return (
                <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 rounded-lg p-3 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-md bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 flex items-center justify-center text-2xl">
                    {getFileIcon(f.file.name, f.file.type)}
                  </div>

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
              );
            })
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button 
            onClick={() => inputRef.current?.click()} 
            className="px-6 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all duration-200 flex items-center gap-2 border border-slate-200 hover:border-slate-300"
          >
            📁 Add Files
          </button>
          <button 
            onClick={uploadAll} 
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            🚀 Upload & Generate
          </button>
        </div>
      </motion.div>
    </div>
  );
}
