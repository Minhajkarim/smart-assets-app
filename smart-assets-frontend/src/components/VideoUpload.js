import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { BsCamera, BsStopCircle, BsPauseCircle } from 'react-icons/bs';

const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'); // Ensure fallback URL for development

const VideoUpload = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [frameCount, setFrameCount] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [mediaStream, setMediaStream] = useState(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordedChunks, setRecordedChunks] = useState([]);
    const [detectedObjects, setDetectedObjects] = useState([]);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Socket.IO listeners
    useEffect(() => {
        if (!process.env.REACT_APP_SOCKET_URL) {
            console.error('Socket URL is not defined. Check your environment variables.');
        }

        socket.on('processingUpdate', (update) => {
            if (update.progress) setProcessingProgress(update.progress);
            if (update.message) setFrameCount(update.message);
        });

        socket.on('objectDetection', (data) => {
            if (data.objects && Array.isArray(data.objects)) {
                setDetectedObjects(data.objects);
                drawBoundingBoxes(data.objects);
            }
        });

        return () => {
            socket.off('processingUpdate');
            socket.off('objectDetection');
        };
    }, []);

    // Start recording video
    const startRecording = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: true,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setMediaStream(stream);

            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            setMediaRecorder(recorder);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    setRecordedChunks((prev) => [...prev, event.data]);
                    socket.emit('frameData', event.data); // Send frame data for object detection
                }
            };

            recorder.start(100); // Record in small chunks (100ms)
            setIsRecording(true);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                alert('Camera or microphone access was denied. Please check your permissions.');
            } else {
                console.error('Error accessing media devices:', error);
            }
        }
    };

    // Pause or Resume recording
    const togglePause = () => {
        if (mediaRecorder) {
            if (isPaused) {
                mediaRecorder.resume();
            } else {
                mediaRecorder.pause();
            }
            setIsPaused(!isPaused);
        }
    };

    // Stop recording video
    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
        }
        setIsRecording(false);
        setIsPaused(false);
    };

    // Save the recorded video
    useEffect(() => {
        if (recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const file = new File([blob], `recorded-${Date.now()}.webm`, { type: 'video/webm' });
            setVideoFile(file);
        }
    }, [recordedChunks]);

    const handleUpload = async () => {
        if (!videoFile) {
            return alert('Please select or record a video to upload.');
        }

        const formData = new FormData();
        formData.append('video', videoFile);

        try {
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/videos/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                },
            });

            alert('Upload successful!');
            console.log('Upload successful:', response.data);
            setVideoFile(null); // Reset video file after upload
        } catch (error) {
            alert('Error uploading video. Please try again.');
            console.error('Error uploading video:', error);
        }
    };

    // Draw bounding boxes
    const drawBoundingBoxes = (objects) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw bounding boxes
        objects.forEach(({ label, x, y, width, height }) => {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            ctx.fillStyle = 'red';
            ctx.font = '16px Arial';
            ctx.fillText(label, x, y - 5);
        });
    };

    // Cleanup resources on component unmount
    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
            }
            if (mediaRecorder) {
                mediaRecorder.stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [mediaStream, mediaRecorder]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex flex-col items-center py-10 px-4">
            <h1 className="text-4xl font-extrabold text-gray-800 mb-8">Object Detection</h1>
            <div className="w-full max-w-5xl bg-white shadow-2xl rounded-lg p-8 flex flex-col space-y-8">
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Record Video</h2>
                    <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
                        <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover" autoPlay muted />
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                            >
                                <BsCamera /> Start Recording
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={togglePause}
                                    className="absolute bottom-4 left-4 bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-700"
                                >
                                    {isPaused ? <BsCamera /> : <BsPauseCircle />}
                                    {isPaused ? 'Resume' : 'Pause'}
                                </button>
                                <button
                                    onClick={stopRecording}
                                    className="absolute bottom-4 left-20 bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
                                >
                                    <BsStopCircle /> Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Upload Video</h2>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => setVideoFile(e.target.files[0])}
                        className="block w-full text-gray-700 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <button
                        onClick={handleUpload}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Upload Video
                    </button>
                </div>

                {/* Upload Progress Bar */}
                {uploadProgress > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-semibold mb-2">Uploading Progress</h3>
                        <div className="relative w-full h-6 bg-gray-200 rounded-lg overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full bg-blue-600 rounded-lg transition-all duration-300 ease-in-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                {uploadProgress}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Processing Progress Bar */}
                {processingProgress > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-semibold mb-2">Processing Progress</h3>
                        <div className="relative w-full h-6 bg-gray-200 rounded-lg overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full bg-green-600 rounded-lg transition-all duration-300 ease-in-out"
                                style={{ width: `${processingProgress}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                                {processingProgress}% - {frameCount}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoUpload;
