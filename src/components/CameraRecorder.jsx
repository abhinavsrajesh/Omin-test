import { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "../firebase";

export default function CameraRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [error, setError] = useState(null);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const liveVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Try to use back camera if available (AR context)
        audio: true,
      });
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      setHasCameraAccess(true);
    } catch (err) {
      setError("Could not access camera. Please allow permissions.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (liveVideoRef.current && liveVideoRef.current.srcObject) {
      const tracks = liveVideoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleStartRecording = () => {
    setRecordedUrl(null);
    chunksRef.current = [];
    const stream = liveVideoRef.current.srcObject;
    if (!stream) return;

    // Check supported mime types
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' };
        }
      }
    }

    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async () => {
    if (!recordedUrl) return;

    try {
      setIsUploading(true);
      setError(null);

      // Convert Object URL back to Blob
      const response = await fetch(recordedUrl);
      const blob = await response.blob();

      // Create a reference in Firebase Storage
      const fileName = `videos/ar-video-${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);

      // Start upload
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (err) => {
          console.error("Upload failed", err);
          setError("Upload failed. Check Firebase config.");
          setIsUploading(false);
        },
        async () => {
          // Upload complete, get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Save metadata to Firestore
          await addDoc(collection(db, "videos"), {
            url: downloadURL,
            filename: fileName,
            createdAt: serverTimestamp()
          });

          setIsUploading(false);
          alert("Video successfully uploaded to Cloud!");
        }
      );
    } catch (err) {
      console.error(err);
      setError("Failed to process video for upload.");
      setIsUploading(false);
    }
  };

  return (
    <div className="camera-container">
      {error && <div className="error-message">{error}</div>}
      
      {!recordedUrl ? (
        <div className="video-wrapper">
          <video 
            ref={liveVideoRef} 
            autoPlay 
            playsInline 
            muted // Muted to avoid feedback loop while recording
            className="live-video"
          />
          {hasCameraAccess && (
            <div className="controls">
              {!isRecording ? (
                <button className="btn btn-record" onClick={handleStartRecording}>
                  <div className="record-icon"></div>
                  Start Recording
                </button>
              ) : (
                <button className="btn btn-stop" onClick={handleStopRecording}>
                  <div className="stop-icon"></div>
                  Stop Recording
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="video-wrapper">
          <video 
            src={recordedUrl} 
            controls 
            autoPlay 
            className="recorded-video"
          />
          <div className="controls playback-controls" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setRecordedUrl(null)} disabled={isUploading}>
              Record Again
            </button>
            <a href={recordedUrl} download="ar-recording.webm" className="btn btn-secondary" style={{ pointerEvents: isUploading ? 'none' : 'auto' }}>
              Download Local
            </a>
            <button className="btn btn-primary" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload to Cloud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
