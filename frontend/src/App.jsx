import React from "react";
import FileUploader from "./components/FileUploader";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <FileUploader uploadUrl={import.meta.env.VITE_UPLOAD_URL || "http://localhost:8000/upload"} />
    </div>
  );
}
