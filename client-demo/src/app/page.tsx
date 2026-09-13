import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
      <h1 className="text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400">
        Distributed Video Transcoder
      </h1>
      <p className="text-xl text-gray-400 mb-12 max-w-2xl leading-relaxed">
        High-throughput asynchronous video transcoding engine. Upload 4K master files directly to S3,
        queue tasks through Apache Kafka, and transcode into multi-bitrate Adaptive HLS (480p to 4K) using Go worker pools.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Upload VOD Card */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl hover:border-blue-500/50 transition-colors flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="text-3xl">⬆️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Upload Video</h2>
          <p className="text-gray-400 mb-6 flex-grow">
            Upload raw 4K videos directly to MinIO storage using secure presigned URLs, bypassing API bottleneck.
          </p>
          <Link
            href="/upload"
            className="w-full py-3 px-4 bg-gray-800 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Upload Now
          </Link>
        </div>

        {/* Watch Gallery Card */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl hover:border-indigo-500/50 transition-colors flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="text-3xl">🍿</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Watch Gallery</h2>
          <p className="text-gray-400 mb-6 flex-grow">
            Browse and watch transcoded VODs with an adaptive HLS player that seamlessly switches bitrates.
          </p>
          <Link
            href="/watch"
            className="w-full py-3 px-4 bg-gray-800 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
          >
            Browse Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
