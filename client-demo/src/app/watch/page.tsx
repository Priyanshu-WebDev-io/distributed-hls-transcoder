"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Hls from "hls.js";

function VideoGallery() {
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/videos')
      .then(res => res.json())
      .then(data => {
        setVideos(data.videos || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p>Loading gallery...</p></div>;
  }

  const deleteVideo = async (e: React.MouseEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/videos/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        setVideos(videos.filter(v => v !== filename));
      } else {
        alert("Failed to delete video");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting video");
    }
  };

  return (
    <div className="flex flex-col items-center p-8 w-full h-full">
      <h1 className="text-3xl font-bold mb-8">Video Gallery</h1>
      {videos.length === 0 ? (
        <p className="text-gray-400">No videos found. Upload one first!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {videos.map(v => (
            <a 
              key={v} 
              href={`/watch?v=${v}`}
              className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors shadow-lg flex flex-col items-center justify-center aspect-video relative group"
            >
              <button 
                onClick={(e) => deleteVideo(e, v)}
                className="absolute top-3 right-3 bg-red-600/80 hover:bg-red-600 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm shadow-md"
                title="Delete Video"
              >
                ✕
              </button>
              <div className="text-6xl mb-4">▶️</div>
              <h2 className="text-lg font-semibold truncate w-full text-center px-4">{v}</h2>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchPlayer() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v"); 

  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<{status: string, progress: number} | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState({
    bufferPercent: 0,
    bufferedSeconds: 0,
    bandwidth: 0,
    bitrate: 0,
    resolution: 'Unknown',
    droppedFrames: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!videoId || !mounted) return;

    let interval = setInterval(() => {
      fetch(`http://localhost:3001/api/progress/${videoId}.mp4`)
        .then(res => res.json())
        .then(data => {
          setProgress(data);
          if (data.status === 'completed') {
            clearInterval(interval);
          }
        })
        .catch(console.error);
    }, 1000);

    return () => clearInterval(interval);
  }, [videoId, mounted]);

  useEffect(() => {
    // If completed or unknown (assumed legacy completed video), initialize HLS
    if ((progress?.status === 'completed' || progress?.status === 'unknown') && videoRef.current) {
      const video = videoRef.current;
      const videoUrl = `http://localhost:9000/public-videos/${videoId}/playlist.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        
        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          setLevels(data.levels);
          setCurrentLevel(hls.currentLevel); // usually -1 for auto
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          // If we are in 'auto' mode, currentLevel is actually -1, but the underlying stream switched.
          // We don't forcefully update currentLevel if it's auto so the UI stays on "Auto"
          if (hls.currentLevel !== -1) {
            setCurrentLevel(data.level);
          }
        });

        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
      }
    }
  }, [progress?.status, videoId]);

  useEffect(() => {
    if (!showMetrics || !videoRef.current || !hlsRef.current) return;
    
    const interval = setInterval(() => {
      const video = videoRef.current;
      const hls = hlsRef.current;
      if (!video || !hls) return;

      let bufferedSeconds = 0;
      let bufferPercent = 0;
      if (video.buffered.length > 0) {
        // Find the buffer range that contains the current time
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) {
            bufferedSeconds = video.buffered.end(i) - video.currentTime;
            if (video.duration > 0) {
              bufferPercent = (video.buffered.end(i) / video.duration) * 100;
            }
            break;
          }
        }
      }

      let droppedFrames = 0;
      // @ts-ignore (getVideoPlaybackQuality is not in all standard TS defs)
      if (video.getVideoPlaybackQuality) {
        droppedFrames = video.getVideoPlaybackQuality().droppedVideoFrames || 0;
      }

      const activeLevel = hls.currentLevel !== -1 ? hls.currentLevel : hls.loadLevel;
      const levelObj = hls.levels[activeLevel];

      setMetrics({
        bufferPercent,
        bufferedSeconds,
        bandwidth: hls.bandwidthEstimate,
        bitrate: levelObj ? levelObj.bitrate : 0,
        resolution: levelObj ? `${levelObj.width}x${levelObj.height}` : 'Unknown',
        droppedFrames,
      });
    }, 500);

    return () => clearInterval(interval);
  }, [showMetrics]);

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      if (levelIndex === -1) {
        hlsRef.current.currentLevel = -1; // Auto immediately
      } else {
        hlsRef.current.currentLevel = levelIndex; // Instant switch (safe now that keyframes are aligned)
      }
      setCurrentLevel(levelIndex);
    }
  };

  if (!mounted) return null;
  if (!videoId) return <VideoGallery />;

  if (progress && progress.status !== 'completed' && progress.status !== 'unknown') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-8 mt-12">
        <h1 className="text-2xl font-bold mb-4">Processing Video...</h1>
        <p className="text-gray-400 mb-8 capitalize">Status: {progress.status}</p>
        <div className="w-full max-w-2xl bg-gray-800 rounded-full h-4 mb-4 overflow-hidden relative shadow-inner">
          <div 
            className="bg-purple-600 h-4 rounded-full transition-all duration-500 ease-out absolute left-0 top-0" 
            style={{ width: `${Math.max(1, progress.progress)}%` }}
          />
        </div>
        <p className="font-mono text-xl">{progress.progress.toFixed(1)}%</p>
      </div>
    );
  }

  const deleteCurrentVideo = async () => {
    if (!videoId) return;
    if (!confirm(`Are you sure you want to delete ${videoId}?`)) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/videos/${videoId}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/watch';
      } else {
        alert("Failed to delete video");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting video");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-5xl aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-2xl relative group">
        <video 
          ref={videoRef}
          controls 
          className="w-full h-full outline-none"
          autoPlay={false}
        />

        {/* Quality Selector Overlay */}
        {levels.length > 0 && (
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded-md p-2 z-10 flex gap-2 backdrop-blur-sm border border-gray-700 shadow-xl">
            <button 
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-gray-400 hover:text-white px-2 flex items-center transition-colors"
              title="Stats for nerds"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center px-2 border-l border-gray-700 ml-1">Quality</span>
            <button 
              onClick={() => changeQuality(-1)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentLevel === -1 ? 'bg-purple-600 text-white shadow-md' : 'text-gray-300 hover:bg-white/20'}`}
            >
              Auto
            </button>
            {levels.map((level, index) => (
              <button 
                key={index}
                onClick={() => changeQuality(index)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentLevel === index ? 'bg-purple-600 text-white shadow-md' : 'text-gray-300 hover:bg-white/20'}`}
              >
                {level.height}p
              </button>
            ))}
          </div>
        )}

        {/* Metrics Overlay */}
        {showMetrics && (
          <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-md text-xs font-mono backdrop-blur-sm border border-gray-700 shadow-xl z-20 w-64 pointer-events-none transition-all duration-300">
            <h3 className="font-bold text-gray-400 mb-2 uppercase tracking-wider border-b border-gray-700 pb-1">Stats for Nerds</h3>
            
            <div className="flex justify-between mb-1">
              <span>Resolution:</span>
              <span className="text-purple-400">{metrics.resolution}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Stream Bitrate:</span>
              <span className="text-purple-400">{(metrics.bitrate / 1000000).toFixed(2)} Mbps</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Est. Bandwidth:</span>
              <span className="text-purple-400">{(metrics.bandwidth / 1000000).toFixed(2)} Mbps</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Dropped Frames:</span>
              <span className={metrics.droppedFrames > 0 ? "text-red-400 font-bold" : "text-green-400"}>{metrics.droppedFrames}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span>Buffer Ahead:</span>
              <span className="text-blue-400">{metrics.bufferedSeconds.toFixed(1)} sec</span>
            </div>

            <div className="mt-2">
              <div className="flex justify-between text-gray-400 mb-1 text-[10px]">
                <span>Loaded Buffer</span>
                <span>{metrics.bufferPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden shadow-inner relative">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500 ease-linear absolute left-0 top-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{ width: `${metrics.bufferPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
      <div className="mt-8 flex justify-between items-start w-full max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold">Playing: {videoId}</h1>
          <p className="text-gray-400 mt-2">Adaptive Bitrate HLS Stream from MinIO (Native Hls.js)</p>
        </div>
        <button 
          onClick={deleteCurrentVideo}
          className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors px-4 py-2 rounded font-medium border border-red-900"
        >
          Delete Video
        </button>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-black text-white p-8">
      <Suspense fallback={<div>Loading player...</div>}>
        <WatchPlayer />
      </Suspense>
    </div>
  );
}
