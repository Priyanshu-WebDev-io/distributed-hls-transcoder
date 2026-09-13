"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Hls from "hls.js";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "http://localhost:9000/public-videos";

interface VideoItem {
  id: number;
  filename: string;
  folder_name: string;
  status: 'ready' | 'transcoding' | 'downloading' | 'pending' | 'failed' | string;
  progress: number;
  created_at?: string;
}

function VideoGallery() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ready' | 'processing'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVideos = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/videos`);
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        setItems(data.items);
      } else if (data.videos && Array.isArray(data.videos)) {
        setItems(data.videos.map((v: string, i: number) => ({
          id: i,
          filename: `${v}.mp4`,
          folder_name: v,
          status: 'ready',
          progress: 100,
        })));
      }
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Real-time polling while any video is being processed
  useEffect(() => {
    const hasProcessing = items.some(item => item.status !== 'ready');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchVideos(true);
    }, 2500);

    return () => clearInterval(interval);
  }, [items]);

  const deleteVideo = async (e: React.MouseEvent, identifier: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${identifier}?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/videos/${identifier}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(v => v.folder_name !== identifier && v.filename !== identifier));
      } else {
        alert("Failed to delete video");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting video");
    }
  };

  const readyItems = items.filter(v => v.status === 'ready');
  const processingItems = items.filter(v => v.status !== 'ready');

  const displayedItems = filter === 'ready' 
    ? readyItems 
    : filter === 'processing' 
      ? processingItems 
      : items;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-gray-400 font-medium">Loading video gallery & jobs...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 md:p-10 w-full max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Video Library</h1>
            {processingItems.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                {processingItems.length} Processing
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Stream multi-bitrate HLS videos and monitor live distributed transcoding progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchVideos()}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium border border-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            title="Refresh list"
          >
            <span className={`inline-block ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
            Refresh
          </button>

          <a
            href="/upload"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2"
          >
            <span>+</span> Upload Video
          </a>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="w-full flex items-center gap-2 mb-8 bg-gray-900/80 p-1.5 rounded-xl border border-gray-800/80 self-start max-w-md">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilter('ready')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            filter === 'ready'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Ready to Stream ({readyItems.length})
        </button>
        <button
          onClick={() => setFilter('processing')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all relative ${
            filter === 'processing'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Processing ({processingItems.length})
          {processingItems.length > 0 && filter !== 'processing' && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute top-2 right-2 animate-pulse" />
          )}
        </button>
      </div>

      {/* Gallery Cards Grid */}
      {displayedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-gray-900/40 rounded-2xl border border-gray-800/80 w-full">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl mb-4 text-gray-500">
            🎬
          </div>
          <h2 className="text-xl font-bold text-gray-200 mb-2">
            {filter === 'processing'
              ? 'No Videos Processing Right Now'
              : filter === 'ready'
              ? 'No Ready Videos Found'
              : 'Your Video Library Is Empty'}
          </h2>
          <p className="text-gray-400 text-sm max-w-sm mb-6">
            {filter === 'processing'
              ? 'All uploaded videos have completed transcoding. Check the "Ready to Stream" tab!'
              : 'Upload an MP4 video to start the distributed transcoding pipeline with adaptive HLS streams.'}
          </p>
          <a
            href="/upload"
            className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors shadow-md"
          >
            Upload New Video
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {displayedItems.map((item) => {
            const isReady = item.status === 'ready';

            if (isReady) {
              return (
                <a
                  key={item.id || item.folder_name}
                  href={`/watch?v=${item.folder_name}`}
                  className="group relative bg-gray-900/90 hover:bg-gray-850 border border-gray-800 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-purple-500/10 transition-all duration-300 flex flex-col"
                >
                  {/* Thumbnail / Play Preview */}
                  <div className="relative aspect-video bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center overflow-hidden border-b border-gray-800/60">
                    <div className="w-14 h-14 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 text-purple-400 shadow-md">
                      ▶
                    </div>

                    <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Ready to Stream
                    </div>

                    <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-gray-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-gray-700/80">
                      Adaptive HLS
                    </div>

                    <button
                      onClick={(e) => deleteVideo(e, item.folder_name)}
                      className="absolute top-3 right-3 bg-red-600/80 hover:bg-red-600 text-white w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow-md"
                      title="Delete Video"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Card Info */}
                  <div className="p-4 flex flex-col gap-1.5 flex-1 justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                        {item.folder_name}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
                        {item.filename}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-3 mt-1 border-t border-gray-800">
                      <span className="text-emerald-400 font-medium">100% Transcoded</span>
                      <span>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Ready'}
                      </span>
                    </div>
                  </div>
                </a>
              );
            }

            // Processing Card
            const statusLabel = 
              item.status === 'transcoding'
                ? 'Transcoding HLS'
                : item.status === 'downloading'
                ? 'Downloading from MinIO'
                : item.status === 'failed'
                ? 'Failed'
                : 'Queued in Kafka';

            const badgeColor =
              item.status === 'transcoding'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : item.status === 'downloading'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : item.status === 'failed'
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300';

            return (
              <div
                key={item.id || item.folder_name}
                className="relative bg-gray-900/90 border border-purple-500/30 rounded-2xl overflow-hidden shadow-lg flex flex-col"
              >
                {/* Processing Visual Area */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 flex flex-col items-center justify-center p-6 border-b border-gray-800/60">
                  {/* Circular Spinner with Progress */}
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-purple-300">
                      {Math.round(item.progress)}%
                    </div>
                  </div>

                  <div className="absolute top-3 left-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 border shadow-sm backdrop-blur-sm ${badgeColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                      {statusLabel}
                    </span>
                  </div>

                  <button
                    onClick={(e) => deleteVideo(e, item.folder_name)}
                    className="absolute top-3 right-3 bg-red-600/80 hover:bg-red-600 text-white w-7 h-7 rounded-full transition-opacity flex items-center justify-center text-xs shadow-md"
                    title="Cancel / Delete Video"
                  >
                    ✕
                  </button>

                  <p className="text-xs text-gray-400 text-center max-w-[220px] truncate mt-1">
                    {item.status === 'transcoding'
                      ? 'Generating 360p-1080p ABR chunks...'
                      : item.status === 'downloading'
                      ? 'Worker downloading raw video...'
                      : 'Waiting in Kafka transcode queue...'}
                  </p>
                </div>

                {/* Progress Details */}
                <div className="p-4 flex flex-col gap-3 flex-1 justify-between bg-gray-900/50">
                  <div>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <h3 className="font-semibold text-gray-200 truncate">{item.folder_name}</h3>
                      <span className="font-mono text-xs font-bold text-purple-400">
                        {item.progress.toFixed(1)}%
                      </span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden relative border border-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                        style={{ width: `${Math.max(5, item.progress)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-gray-500 pt-2 border-t border-gray-800">
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      Worker active
                    </span>
                    <span>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Processing'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
      fetch(`${API_URL}/api/progress/${videoId}.mp4`)
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
      const videoUrl = `${S3_PUBLIC_URL}/${videoId}/playlist.m3u8`;

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
      <div className="flex flex-col items-center justify-center w-full h-full p-8 max-w-2xl mx-auto">
        <a 
          href="/watch" 
          className="self-start mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-gray-900 hover:bg-gray-800 px-3.5 py-2 rounded-xl border border-gray-800"
        >
          ← Back to Video Library
        </a>
        <div className="w-full bg-gray-900 border border-purple-500/30 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mb-4" />
          <h1 className="text-2xl font-bold mb-2">Transcoding in Progress</h1>
          <p className="text-purple-400 text-sm font-semibold capitalize mb-6 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
            Status: {progress.status}
          </p>
          <div className="w-full bg-gray-950 rounded-full h-3 mb-3 overflow-hidden relative border border-gray-800">
            <div 
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400 h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${Math.max(2, progress.progress)}%` }}
            />
          </div>
          <p className="font-mono text-2xl font-bold text-white mb-2">{progress.progress.toFixed(1)}%</p>
          <p className="text-gray-400 text-xs">
            Worker is generating adaptive bitrate HLS ladders. Player will start automatically when done.
          </p>
        </div>
      </div>
    );
  }

  const deleteCurrentVideo = async () => {
    if (!videoId) return;
    if (!confirm(`Are you sure you want to delete ${videoId}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/videos/${videoId}`, { method: 'DELETE' });
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
    <div className="flex flex-col items-center justify-center w-full max-w-5xl">
      <div className="w-full flex items-center justify-between mb-4">
        <a 
          href="/watch" 
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-gray-900 hover:bg-gray-800 px-3.5 py-1.5 rounded-xl border border-gray-800"
        >
          ← Back to Video Library
        </a>
      </div>
      <div className="w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl relative group border border-gray-800">
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
