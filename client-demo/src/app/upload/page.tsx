"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setStatus("Generating secure upload URL...");

    try {
      // 1. Get presigned URL
      const urlRes = await fetch("http://localhost:3001/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const { url } = await urlRes.json();

      if (!url) throw new Error("Failed to get upload URL");

      // 2. Upload file directly to MinIO
      setStatus("Uploading directly to storage (bypassing server)...");
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      // 3. Trigger transcode job via Kafka
      setStatus("Upload complete! Queuing transcode job...");
      const transcodeRes = await fetch("http://localhost:3001/api/transcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });

      if (!transcodeRes.ok) throw new Error("Transcode queuing failed");

      setStatus("Success! The Go background worker is now transcoding your video.");
    } catch (e: any) {
      console.error(e);
      setStatus("Error: " + e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-[500px] flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-center">Upload Video (VOD)</h1>
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="p-4 border border-dashed border-gray-600 rounded bg-gray-700"
        />
        <button 
          onClick={handleUpload}
          disabled={!file}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
        >
          Upload to Platform
        </button>
        {status && <p className="text-center text-sm text-green-400 mt-2">{status}</p>}
      </div>
    </div>
  );
}
