import React, { useState, useRef, useEffect } from 'react';

interface VideoScoringProps {}

const VideoScoring: React.FC<VideoScoringProps> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevDataRef = useRef<ImageData | null>(null);
  const [score, setScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [lastHitTime, setLastHitTime] = useState<number>(0);
  const [debug, setDebug] = useState<boolean>(false);
  const frameRef = useRef<number>();

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setIsPlaying(false);
      setScore(0);
      prevDataRef.current = null;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const processFrame = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const currentData = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    if (prevDataRef.current) {
      findTargetAndDetectHit(ctx, currentData, prevDataRef.current);
    }

    prevDataRef.current = currentData;
    frameRef.current = requestAnimationFrame(processFrame);
  };

  const findTargetAndDetectHit = (
    ctx: CanvasRenderingContext2D,
    currentData: ImageData,
    prevData: ImageData
  ) => {
    const data = currentData.data;
    const prevDataArr = prevData.data;
    const width = currentData.width;
    const height = currentData.height;

    let redPixels = [];
    let motionPixels = [];

    // 빨간 원과 움직임 검출
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 빨간색 감지
        if (r > 150 && g < 100 && b < 100) {
          redPixels.push({ x, y });
        }

        // 움직임 감지
        const pr = prevDataArr[idx];
        const pg = prevDataArr[idx + 1];
        const pb = prevDataArr[idx + 2];

        const diff = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
        if (diff > 100) {
          // 움직임 임계값
          motionPixels.push({ x, y });
        }
      }
    }

    if (redPixels.length > 100) {
      const centerX =
        redPixels.reduce((sum, p) => sum + p.x, 0) / redPixels.length;
      const centerY =
        redPixels.reduce((sum, p) => sum + p.y, 0) / redPixels.length;
      const radius = Math.sqrt(redPixels.length / Math.PI);
      const gridSize = radius * 4;

      const targetArea = {
        minX: centerX - gridSize,
        maxX: centerX + gridSize,
        minY: centerY - gridSize,
        maxY: centerY + gridSize,
      };

      drawGrid(ctx, targetArea);

      if (debug) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'blue';
        ctx.fill();

        // 움직임 표시
        motionPixels.forEach(({ x, y }) => {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fill();
        });
      }

      if (motionPixels.length > 0) {
        detectHitFromMotion(ctx, targetArea, motionPixels);
      }
    }
  };

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    area: { minX: number; maxX: number; minY: number; maxY: number }
  ) => {
    const width = area.maxX - area.minX;
    const height = area.maxY - area.minY;

    ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    ctx.lineWidth = 2;

    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(area.minX + (i * width) / 3, area.minY);
      ctx.lineTo(area.minX + (i * width) / 3, area.maxY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(area.minX, area.minY + (i * height) / 3);
      ctx.lineTo(area.maxX, area.minY + (i * height) / 3);
      ctx.stroke();
    }

    if (debug) {
      const points = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      ctx.font = '24px Arial';
      ctx.fillStyle = 'yellow';

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const x = area.minX + (j + 0.5) * (width / 3);
          const y = area.minY + (i + 0.5) * (height / 3);
          ctx.fillText(points[i][j].toString(), x - 10, y + 10);
        }
      }
    }
  };

  const detectHitFromMotion = (
    ctx: CanvasRenderingContext2D,
    area: { minX: number; maxX: number; minY: number; maxY: number },
    motionPixels: Array<{ x: number; y: number }>
  ) => {
    const currentTime = Date.now();
    if (currentTime - lastHitTime < 500) return;

    const points = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    const targetWidth = area.maxX - area.minX;
    const targetHeight = area.maxY - area.minY;

    // 움직임의 중심점 계산
    const motionCenterX =
      motionPixels.reduce((sum, p) => sum + p.x, 0) / motionPixels.length;
    const motionCenterY =
      motionPixels.reduce((sum, p) => sum + p.y, 0) / motionPixels.length;

    // 격자 내 위치 계산
    const gridX = Math.floor(((motionCenterX - area.minX) / targetWidth) * 3);
    const gridY = Math.floor(((motionCenterY - area.minY) / targetHeight) * 3);

    if (
      gridX >= 0 &&
      gridX < 3 &&
      gridY >= 0 &&
      gridY < 3 &&
      motionPixels.length > 50
    ) {
      const newScore = points[gridY][gridX];
      setScore((prev) => prev + newScore);
      setLastHitTime(currentTime);

      ctx.beginPath();
      ctx.arc(motionCenterX, motionCenterY, 15, 0, 2 * Math.PI);
      ctx.strokeStyle = debug ? '#00ff00' : 'yellow';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.fillStyle = debug ? '#00ff00' : 'yellow';
      ctx.fillText(`+${newScore}`, motionCenterX + 20, motionCenterY);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(processFrame);
      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }
      };
    }
  }, [isPlaying, debug]);

  return (
    <div style={{ padding: '1rem', maxWidth: '42rem', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            src={videoUrl || undefined}
            style={{
              width: '100%',
              height: '16rem',
              backgroundColor: '#111',
              borderRadius: '0.5rem',
            }}
          />
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              영상 업로드
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={togglePlayPause}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                backgroundColor: '#22c55e',
                color: 'white',
                borderRadius: '0.5rem',
              }}
            >
              {isPlaying ? '일시정지' : '재생'}
            </button>
            <button
              onClick={() => setDebug((prev) => !prev)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: debug ? '#ef4444' : '#6b7280',
                color: 'white',
                borderRadius: '0.5rem',
              }}
            >
              디버그 모드 {debug ? 'OFF' : 'ON'}
            </button>
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
            }}
          >
            점수: {score}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoScoring;
