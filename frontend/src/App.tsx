import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Settings } from 'lucide-react';

declare global {
  interface Window {
    fabric: any;
  }
}

interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Detection {
  class_name: string;
  confidence: number;
  box: BoundingBox;
}

interface PredictionResult {
  id: string;
  videoTime: string;
  detections: Detection[];
  usedConfidence: number;
  usedIou: number;
}

const API_BASE_URL = 'http://localhost:5000';

const ObjectDetectionDashboard: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0.7);
  const [iou, setIou] = useState(0.5);
  const [modelName, setModelName] = useState('yolov8s');
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [currentDetections, setCurrentDetections] = useState<Detection[]>([]);
  const [modelStatus, setModelStatus] = useState('');
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 0, height: 0 });
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const confidenceRef = useRef(confidence);
  const iouRef = useRef(iou);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricInstanceRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    confidenceRef.current = confidence;
  }, [confidence]);

  useEffect(() => {
    iouRef.current = iou;
  }, [iou]);

  const formatVideoTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
  };

  const classColors: Record<string, string> = {
    person: '#ff4444',
    car: '#44ff44',
    truck: '#4444ff',
    bus: '#ffff44',
    bicycle: '#ff44ff',
    dog: '#44ffff',
    cat: '#ff8844',
    motorcycle: '#ff8800',
    airplane: '#8844ff',
    boat: '#44ff88',
    traffic_light: '#ff0088',
    fire_hydrant: '#88ff00',
    stop_sign: '#0088ff',
    parking_meter: '#ff4400',
    bench: '#4400ff',
  };

  const getColorForClass = (className: string): string => {
    return classColors[className] || '#ffffff';
  };

  // Get actual video display size from DOM
  const getVideoDisplaySize = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoSize.width === 0 || videoSize.height === 0) {
      return { width: 0, height: 0 };
    }

    const rect = video.getBoundingClientRect();
    const videoAspectRatio = videoSize.width / videoSize.height;
    
    // Calculate actual displayed video size
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    
    const containerAspectRatio = rect.width / rect.height;
    
    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider than container
      displayHeight = rect.width / videoAspectRatio;
    } else {
      // Video is taller than container
      displayWidth = rect.height * videoAspectRatio;
    }
    
    return { width: Math.round(displayWidth), height: Math.round(displayHeight) };
  }, [videoSize]);

  // Initialize Fabric.js canvas with correct dimensions
  const initializeFabricCanvas = useCallback(() => {
    if (fabricCanvasRef.current && window.fabric && !fabricInstanceRef.current && videoDisplaySize.width > 0 && videoDisplaySize.height > 0) {
      const fabricCanvas = new window.fabric.Canvas(fabricCanvasRef.current, {
        width: videoDisplaySize.width,
        height: videoDisplaySize.height,
        backgroundColor: '#000000'
      });
      fabricInstanceRef.current = fabricCanvas;
    }
  }, [videoDisplaySize]);

  // Resize Fabric.js canvas when video display size changes
  const resizeFabricCanvas = useCallback(() => {
    if (fabricInstanceRef.current && videoDisplaySize.width > 0 && videoDisplaySize.height > 0) {
      fabricInstanceRef.current.setDimensions({
        width: videoDisplaySize.width,
        height: videoDisplaySize.height
      });
      fabricInstanceRef.current.renderAll();
    }
  }, [videoDisplaySize]);

  // Calculate unified scaling parameters for both image and bounding boxes
  const calculateScalingParams = useCallback((imageWidth: number, imageHeight: number) => {
    if (!fabricInstanceRef.current || videoDisplaySize.width === 0 || videoDisplaySize.height === 0) {
      return null;
    }

    const fabricCanvas = fabricInstanceRef.current;
    const scaleX = fabricCanvas.width / imageWidth;
    const scaleY = fabricCanvas.height / imageHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;
    const offsetX = (fabricCanvas.width - scaledWidth) / 2;
    const offsetY = (fabricCanvas.height - scaledHeight) / 2;
    
    return {
      scale,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    };
  }, [videoDisplaySize]);

  // Add bounding boxes
  const addBoundingBoxes = useCallback((fabricCanvas: any, detections: Detection[], scalingParams: any) => {
    if (!scalingParams || videoSize.width === 0 || videoSize.height === 0) return;
    
    const { scale, offsetX, offsetY } = scalingParams;
    
    detections.forEach((detection, index) => {
      const { box, class_name, confidence } = detection;
      const color = getColorForClass(class_name);
      
      const scaledLeft = box.left * scale + offsetX;
      const scaledTop = box.top * scale + offsetY;
      const scaledWidth = box.width * scale;
      const scaledHeight = box.height * scale;
      
      // Create bounding box rectangle
      const rect = new window.fabric.Rect({
        left: scaledLeft,
        top: scaledTop,
        width: scaledWidth,
        height: scaledHeight,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
        selectable: false,
        evented: false
      });
      
      // Create label text
      const label = `${class_name} ${(confidence * 100).toFixed(1)}%`;
      const text = new window.fabric.Text(label, {
        left: scaledLeft,
        top: Math.max(offsetY, scaledTop - 20),
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: color,
        selectable: false,
        evented: false
      });
      
      fabricCanvas.add(rect);
      fabricCanvas.add(text);
    });
  }, [videoSize, getColorForClass]);

  // Update Fabric.js canvas with current frame and detections
  const updateFabricCanvas = useCallback((frameImageData: string, detections: Detection[]) => {
    if (!fabricInstanceRef.current || !window.fabric || videoDisplaySize.width === 0 || videoDisplaySize.height === 0) return;

    const fabricCanvas = fabricInstanceRef.current;
    
    // Clear the canvas completely
    fabricCanvas.clear();

    if (frameImageData) {
      window.fabric.Image.fromURL(`data:image/jpeg;base64,${frameImageData}`, (img: any) => {
        const scalingParams = calculateScalingParams(img.width, img.height);
        
        if (!scalingParams) return;
        
        const { scale, offsetX, offsetY } = scalingParams;
        
        img.scale(scale);
        img.set({
          left: offsetX,
          top: offsetY,
          selectable: false,
          evented: false
        });
        
        fabricCanvas.add(img);
        fabricCanvas.sendToBack(img);
        
        addBoundingBoxes(fabricCanvas, detections, scalingParams);
        
        fabricCanvas.renderAll();
      });
    } else {
      const scalingParams = calculateScalingParams(videoSize.width, videoSize.height);
      if (scalingParams) {
        addBoundingBoxes(fabricCanvas, detections, scalingParams);
      }
      fabricCanvas.renderAll();
    }
  }, [videoDisplaySize, calculateScalingParams, addBoundingBoxes, videoSize]);

  // Check model health
  const checkModelHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health_check`);
      const status = await response.text();
      setModelStatus(status);
    } catch (error) {
      setModelStatus('Failed to connect to backend');
    }
  };

  // Load model 
  const loadModel = useCallback(async (model: string) => {
    setIsLoadingModel(true);
    try {
      const response = await fetch(`${API_BASE_URL}/load_model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: model }),
      });
      const result = await response.text();
      setModelStatus(result);
    } catch (error) {
      setModelStatus('Failed to load model');
    } finally {
      setIsLoadingModel(false);
    }
  }, []);

  // Handle video file upload
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      // Reset state
      setIsPlaying(false);
      setPredictions([]);
      setCurrentDetections([]);
      setVideoSize({ width: 0, height: 0 });
      setVideoDisplaySize({ width: 0, height: 0 });
      
      // Dispose of existing fabric canvas
      if (fabricInstanceRef.current) {
        fabricInstanceRef.current.dispose();
        fabricInstanceRef.current = null;
      }
      
      // Clear any existing intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      console.log(`Uploaded video: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }
  };

  // Update video size when metadata loads
  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      const newVideoSize = {
        width: video.videoWidth,
        height: video.videoHeight
      };
      setVideoSize(newVideoSize);
      
      // Wait a bit for the video element to render, then get actual display size
      setTimeout(() => {
        const displaySize = getVideoDisplaySize();
        if (displaySize.width > 0 && displaySize.height > 0) {
          setVideoDisplaySize(displaySize);
        }
      }, 100);
    }
  };

  // Update display size when video is resized
  const handleVideoResize = useCallback(() => {
    if (videoSize.width > 0 && videoSize.height > 0) {
      const displaySize = getVideoDisplaySize();
      if (displaySize.width > 0 && displaySize.height > 0) {
        setVideoDisplaySize(displaySize);
      }
    }
  }, [videoSize, getVideoDisplaySize]);

  // Capture frame from video and convert to base64
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    const base64Data = dataURL.split(',')[1];
    
    return base64Data;
  }, []);

  // Send frame to API for prediction
  const processFrame = useCallback(async () => {
    if (!videoRef.current || isProcessing) return;

    const frameData = captureFrame();
    if (!frameData) return;

    const video = videoRef.current;
    const currentTime = video ? video.currentTime : 0;

    setIsProcessing(true);
    try {
      const currentConfidence = confidenceRef.current;
      const currentIou = iouRef.current;

      const detectionResponse = await fetch(`${API_BASE_URL}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: frameData,
          confidence: currentConfidence,
          iou: currentIou,
        }),
      });

      if (detectionResponse.ok) {
        const detections: Detection[] = await detectionResponse.json();
        setCurrentDetections(detections);
        updateFabricCanvas(frameData, detections);
        
        const newPrediction: PredictionResult = {
          id: Date.now().toString(),
          videoTime: formatVideoTime(currentTime),
          detections,
          usedConfidence: currentConfidence,
          usedIou: currentIou,
        };
        
        setPredictions(prev => [newPrediction, ...prev].slice(0, 10));
      } else {
        console.error('Detection API error:', await detectionResponse.text());
        updateFabricCanvas(frameData, []);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      updateFabricCanvas(frameData, []);
    } finally {
      setIsProcessing(false);
    }
  }, [captureFrame, isProcessing, updateFabricCanvas, formatVideoTime]);

  // Handle video play event
  const handleVideoPlay = () => {
    setIsPlaying(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(processFrame, 300);
  };

  // Handle video pause event
  const handleVideoPause = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Handle video ended event
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Clear video and reset state
  const handleClearVideo = () => {
    setVideoFile(null);
    setVideoUrl('');
    setIsPlaying(false);
    setPredictions([]);
    setCurrentDetections([]);
    setVideoSize({ width: 0, height: 0 });
    setVideoDisplaySize({ width: 0, height: 0 });
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (fabricInstanceRef.current) {
      fabricInstanceRef.current.clear();
    }
  };

  // Load model when model name changes
  useEffect(() => {
    loadModel(modelName);
  }, [modelName, loadModel]);

  // Initialize Fabric.js when component mounts
  useEffect(() => {
    if (!window.fabric) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js';
      script.onload = () => {
        if (videoDisplaySize.width > 0 && videoDisplaySize.height > 0) {
          initializeFabricCanvas();
        }
      };
      document.head.appendChild(script);
    } else if (videoDisplaySize.width > 0 && videoDisplaySize.height > 0) {
      initializeFabricCanvas();
    }

    return () => {
      if (fabricInstanceRef.current) {
        fabricInstanceRef.current.dispose();
        fabricInstanceRef.current = null;
      }
    };
  }, [initializeFabricCanvas, videoDisplaySize]);

  // Resize canvas when video display size changes
  useEffect(() => {
    if (videoDisplaySize.width > 0 && videoDisplaySize.height > 0) {
      if (fabricInstanceRef.current) {
        resizeFabricCanvas();
      } else if (window.fabric) {
        initializeFabricCanvas();
      }
    }
  }, [videoDisplaySize, resizeFabricCanvas, initializeFabricCanvas]);

  // Add resize listener for video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resizeObserver = new ResizeObserver(() => {
      handleVideoResize();
    });

    resizeObserver.observe(video);

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleVideoResize]);

  // Initialize model health check
  useEffect(() => {
    checkModelHealth();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-full mx-auto px-2">
        <h1 className="text-3xl font-bold mb-6 text-center">AI Object Detection Dashboard</h1>
        
        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isLoadingModel}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 disabled:opacity-50"
              >
                <option value="yolov8n">YOLOv8 Nano (Fast)</option>
                <option value="yolov8s">YOLOv8 Small (Accurate)</option>
              </select>
              {isLoadingModel && (
                <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-yellow-400"></div>
                  Loading model...
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">{modelStatus}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Confidence: {confidence.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                IoU: {iou.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={iou}
                onChange={(e) => setIou(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Video Player */}
          <div className="xl:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Video Player</h2>
              
              {!videoFile ? (
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-400 mb-4">Upload a video file</p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded cursor-pointer inline-block"
                  >
                    Choose Video
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full rounded"
                      controls={true}
                      preload="metadata"
                      playsInline
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onPlay={handleVideoPlay}
                      onPause={handleVideoPause}
                      onEnded={handleVideoEnded}
                      style={{
                        objectFit: 'contain',
                        maxWidth: '100%',
                        height: 'auto',
                        maxHeight: '400px'
                      }}
                    />
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleClearVideo}
                      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                    >
                      Clear Video
                    </button>
                  </div>
                  
                  <div className="text-center text-sm text-gray-400">
                    Video: {videoSize.width}x{videoSize.height} | Display: {videoDisplaySize.width}x{videoDisplaySize.height}
                    <br />
                    Detections: {currentDetections.length}
                    {videoFile && (
                      <div>File: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)}MB)</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fabric.js Preview Area */}
          <div className="xl:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Detection Preview</h2>
              <div className="flex justify-center mb-4">
                <canvas
                  ref={fabricCanvasRef}
                  className="border border-gray-600 rounded max-w-full"
                />
              </div>
              <div className="text-center text-sm text-gray-400">
                Real-time preview with bounding boxes
                {videoSize.width > 0 && videoSize.height > 0 && (
                  <div>
                    Canvas: {videoDisplaySize.width}x{videoDisplaySize.height}
                    <br />
                    Aspect Ratio: {(videoSize.width / videoSize.height).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Predictions Table */}
          <div className="xl:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Last 10 Predictions</h2>
              
              <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '500px' }}>
                {predictions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No predictions yet</p>
                ) : (
                  predictions.map((prediction) => (
                    <div key={prediction.id} className="bg-gray-700 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{prediction.videoTime}</span>
                        <div className="text-xs text-gray-400">
                          Conf: {prediction.usedConfidence.toFixed(2)} | IoU: {prediction.usedIou.toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {prediction.detections.map((detection, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span 
                              className="font-medium"
                              style={{ color: getColorForClass(detection.class_name) }}
                            >
                              {detection.class_name}
                            </span>
                            <span className="text-gray-300">
                              {(detection.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                        {prediction.detections.length === 0 && (
                          <span className="text-gray-400 text-sm">No objects detected</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default ObjectDetectionDashboard;