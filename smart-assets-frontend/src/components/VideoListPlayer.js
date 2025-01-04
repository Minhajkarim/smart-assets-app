import React, { useEffect, useState } from 'react';
import axios from 'axios';

const VideoListPlayer = () => {
    const [videos, setVideos] = useState([]); // List of processed videos
    const [selectedVideo, setSelectedVideo] = useState(null); // Currently selected video to play
    const [loading, setLoading] = useState(true); // Loading state for fetching videos
    const [error, setError] = useState(null); // Error state

    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await axios.get(`${backendUrl}/api/videos`);
                console.log(response.data); // Debug API response
                setVideos(Array.isArray(response.data) ? response.data : []); // Ensure videos is always an array
                setLoading(false);
            } catch (err) {
                console.error('Error fetching videos:', err);
                setError('Failed to load videos. Please try again later.');
                setLoading(false);
            }
        };

        fetchVideos();
    }, [backendUrl]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-10 px-6 sm:px-8">
            <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">Processed Videos</h1>

            {error && (
                <div className="text-red-600 text-center mb-6">
                    {error}
                </div>
            )}

            <div className="bg-white shadow-lg rounded-lg p-6 max-w-4xl mx-auto">
                {loading ? (
                    <p className="text-gray-500 text-center">Loading videos...</p>
                ) : videos.length === 0 ? (
                    <p className="text-gray-500 text-center">No processed videos available.</p>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {videos.map((video) => (
                            <li key={video._id} className="py-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
                                <span className="text-gray-700 text-lg">{video.filename}</span>
                                <div className="flex space-x-4">
                                    <button
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        onClick={() => setSelectedVideo(video)}
                                    >
                                        Play Video
                                    </button>
                                    <a
                                        href={`${backendUrl}${video.processedPath}`}
                                        download={video.filename}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                                    >
                                        Download
                                    </a>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedVideo && (
                <div className="mt-10 bg-white shadow-lg rounded-lg p-6 max-w-4xl mx-auto">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                        Now Playing: {selectedVideo.filename}
                    </h2>
                    <video
                        width="100%"
                        height="auto"
                        controls
                        autoPlay
                        preload="auto"
                        src={`${backendUrl}${selectedVideo.processedPath}`}
                        className="w-full h-auto rounded-lg border border-gray-300"
                    >
                        Your browser does not support the video tag.
                    </video>
                    <button
                        className="mt-6 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                        onClick={() => setSelectedVideo(null)}
                    >
                        Close Player
                    </button>
                </div>
            )}
        </div>
    );
};

export default VideoListPlayer;
