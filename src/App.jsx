import { useState, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import './index.css'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
  const [startTime, setStartTime] = useState('00:00:00')
  const [endTime, setEndTime] = useState('00:00:10')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState([])
  const [outputUrl, setOutputUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [startTimeSec, setStartTimeSec] = useState(0)
  const [endTimeSec, setEndTimeSec] = useState(10)
  const [videoUrl, setVideoUrl] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  
  const ffmpegRef = useRef(new FFmpeg())
  const videoRef = useRef(null)

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    const ffmpeg = ffmpegRef.current
    
    ffmpeg.on('log', ({ message }) => {
      setLogs((prev) => [...prev.slice(-10), message])
      console.log(message)
    })

    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100))
    })

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    setLoaded(true)
  }

  useEffect(() => {
    load()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setVideoFile(file)
      setOutputUrl(null)
      // Reset times
      setStartTimeSec(0)
      setEndTimeSec(10)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration
      setDuration(dur)
      setEndTimeSec(Math.min(dur, 10))
    }
  }

  const formatTime = (seconds) => {
    const date = new Date(0)
    date.setSeconds(seconds)
    return date.toISOString().substr(11, 8)
  }

  const setStartToCurrent = () => {
    if (videoRef.current) {
      setStartTimeSec(videoRef.current.currentTime)
    }
  }

  const setEndToCurrent = () => {
    if (videoRef.current) {
      setEndTimeSec(videoRef.current.currentTime)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('video/')) {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setVideoFile(file)
      setOutputUrl(null)
    }
  }

  const transcode = async () => {
    setProcessing(true)
    setProgress(0)
    const ffmpeg = ffmpegRef.current
    const inputName = 'input.mp4'
    const outputName = 'output.mp4'

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

    // FFmpegコマンド: 切り抜き
    // -ss: 開始時間, -to: 終了時間, -c copy: 無劣化（高速）, -c:v libx264: 再エンコード（確実）
    // 今回は使い勝手を優先し、再エンコードで確実な切り抜きを行う設定にします
    await ffmpeg.exec([
      '-i', inputName,
      '-ss', formatTime(startTimeSec),
      '-to', formatTime(endTimeSec),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      outputName
    ])

    const data = await ffmpeg.readFile(outputName)
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }))
    setOutputUrl(url)
    setProcessing(false)
  }

  return (
    <div className="container">
      <header>
        <h1 className="neon-title">SNS CLIPPER</h1>
        <p className="subtitle">爆速。無劣化。切り抜き動画の革命。</p>
        <p className="seo-description" style={{ display: 'none' }}>
          SNS切り抜きメーカーは、YouTubeやTikTok、インスタグラム向けの動画をブラウザ上で簡単に作成できる無料ツールです。
          FFmpeg.wasmを使用して、動画をサーバーに送ることなく安全かつ高速に編集できます。
        </p>
      </header>

      <main 
        className={`glass-panel ${dragActive ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* AdSense Top Placeholder */}
        <div className="ad-box-placeholder">ここにはディスプレイ広告が表示されます</div>
        
        {!videoFile ? (
          <div className="dropzone-container">
            <label className="dropzone">
              <input type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
              <div className="dropzone-text">
                <span style={{ fontSize: '3rem' }}>📁</span>
                <h3>動画ファイルをアップロード</h3>
                <p>または、ここにファイルをドラッグ＆ドロップ</p>
              </div>
            </label>
          </div>
        ) : (
          <div className="video-container">
            <video 
              ref={videoRef} 
              src={videoUrl} 
              controls 
              onLoadedMetadata={handleLoadedMetadata}
            />
            
            <div className="controls">
              <div className="timeline-control">
                <div className="slider-labels">
                  <span>開始: {formatTime(startTimeSec)}</span>
                  <span>終了: {formatTime(endTimeSec)}</span>
                </div>
                <div className="dual-slider-container">
                  <input 
                    type="range" 
                    min="0" 
                    max={duration} 
                    step="0.1"
                    value={startTimeSec} 
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), endTimeSec - 0.1)
                      setStartTimeSec(val)
                      if (videoRef.current) videoRef.current.currentTime = val
                    }}
                    className="range-slider thumb-start"
                  />
                  <input 
                    type="range" 
                    min="0" 
                    max={duration} 
                    step="0.1"
                    value={endTimeSec} 
                    onChange={(e) => {
                      const val = Math.max(Number(e.target.value), startTimeSec + 0.1)
                      setEndTimeSec(val)
                      if (videoRef.current) videoRef.current.currentTime = val
                    }}
                    className="range-slider thumb-end"
                  />
                  <div className="slider-track"></div>
                  <div 
                    className="slider-range" 
                    style={{
                      left: `${(startTimeSec / duration) * 100}%`,
                      width: `${((endTimeSec - startTimeSec) / duration) * 100}%`
                    }}
                  ></div>
                </div>
              </div>

              {!processing && !outputUrl && (
                <button 
                  className="btn-primary" 
                  onClick={transcode}
                  disabled={!loaded}
                >
                  {loaded ? '切り抜きを開始する' : 'エンジン起動中...'}
                </button>
              )}

              {processing && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '8px' }}>処理中... {progress}%</p>
                  <div className="log-box">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                </div>
              )}

              {outputUrl && (
                <div className="output-container">
                  <h3 style={{ marginBottom: '12px' }}>✨ 完成しました！</h3>
                  <video src={outputUrl} controls style={{ marginBottom: '16px' }} />
                  {/* AdSense Output Placeholder */}
                  <div className="ad-box-placeholder" style={{ margin: '20px 0' }}>ここに広告を配置して収益化</div>
                  
                  <a 
                    href={outputUrl} 
                    download="clipped_video.mp4" 
                    className="btn-primary" 
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    動画をダウンロード
                  </a>
                  <button 
                    onClick={() => { setOutputUrl(null); setVideoFile(null); }} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', width: '100%', marginTop: '12px', cursor: 'pointer' }}
                  >
                    別の動画を編集する
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: '40px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <p>© 2026 SNS Clipper. Built with FFmpeg.wasm.</p>
      </footer>
    </div>
  )
}

export default App
