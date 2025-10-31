import React, { useState } from "react";
import FileUploader from "./components/FileUploader";
import CodeViewer from "./components/CodeViewer";

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <FileUploader
          uploadUrl={import.meta.env.VITE_UPLOAD_URL || "http://localhost:8000/upload"}
          onUploadComplete={handleUploadComplete}
        />
        <CodeViewer refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
