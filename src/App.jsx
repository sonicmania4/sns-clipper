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
  const [isVertical, setIsVertical] = useState(false)
  const [transcribeEnabled, setTranscribeEnabled] = useState(false)
  const [transcriptionStatus, setTranscriptionStatus] = useState('')
  const [captions, setCaptions] = useState([])
  
  const ffmpegRef = useRef(new FFmpeg())
  const videoRef = useRef(null)
  const workerRef = useRef(null)

  useEffect(() => {
    // Workerの初期化
    workerRef.current = new Worker(new URL('./transcriptionWorker.js', import.meta.url), {
      type: 'module'
    })

    workerRef.current.onmessage = (e) => {
      const { status, message, result } = e.data
      if (status === 'loading' || status === 'processing' || status === 'ready') {
        setTranscriptionStatus(message)
      } else if (status === 'done') {
        setTranscriptionStatus('文字起こし完了！')
        setCaptions(result.chunks)
      } else if (status === 'error') {
        console.error('Transcription Worker Error:', message)
        setTranscriptionStatus(`エラー: ${message}`)
      }
    }

    workerRef.current.onerror = (e) => {
      console.error('Worker Fatal Error:', e)
      setTranscriptionStatus('Workerエラーが発生しました。ブラウザのコンソールを確認してください。')
    }

    return () => {
      workerRef.current.terminate()
    }
  }, [])

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

  const transcribeAudio = async () => {
    if (!videoFile) return
    setTranscriptionStatus('音声データ抽出中...')
    const ffmpeg = ffmpegRef.current
    const inputName = 'input.mp4'
    const audioName = 'audio.wav'

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile))
    
    // AI解析用に16kHzのWAVを抽出
    await ffmpeg.exec([
      '-i', inputName,
      '-ar', '16000',
      '-ac', '1',
      audioName
    ])

    const data = await ffmpeg.readFile(audioName)
    const audioBlob = new Blob([data.buffer], { type: 'audio/wav' })
    
    // AudioBufferに変換してWorkerに送信
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const float32Data = audioBuffer.getChannelData(0)

    console.log('Sending audio to worker, length:', float32Data.length)
    workerRef.current.postMessage({ audio: float32Data })
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
    const fontName = 'font.ttf'

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

    // フォントのロード（日本語表示に必須）
    setTranscriptionStatus('フォント(日本語対応)を準備中...')
    // 軽量な日本語フォント (M PLUS 1p) を使用
    const fontUrl = 'https://fonts.gstatic.com/s/mplus1p/v41/mt-997G_S7HNP7Bpxv0U.ttf' 
    const res = await fetch(fontUrl)
    const fontData = await res.arrayBuffer()
    await ffmpeg.writeFile(fontName, new Uint8Array(fontData))

    // FFmpegコマンド: 切り抜き + (オプション) 縦型クロップ + (オプション) 字幕
    let filterArgs = isVertical ? ['-vf', `crop=ih*9/16:ih`] : []

    if (transcribeEnabled && captions.length > 0) {
      // 字幕フィルターの構成（再生開始時間を考慮して時間をずらす）
      const drawTexts = captions
        .filter(c => {
          const end = c.timestamp[1] || c.timestamp[0] + 2
          return end > startTimeSec && c.timestamp[0] < endTimeSec
        })
        .map(c => {
          const text = c.text.trim()
            .replace(/'/g, "") // FFmpeg escaping
            .replace(/:/g, "\\:")
            .replace(/,/g, "\\,")
            .replace(/;/g, "\\;")
          // タイムスタンプを切り抜き後の時間（0から開始）に調整
          const start = Math.max(0, c.timestamp[0] - startTimeSec)
          const end = (c.timestamp[1] || c.timestamp[0] + 2) - startTimeSec
          // 黄色い文字に太い黒縁（SNSで定番のスタイル）
          return `drawtext=fontfile=${fontName}:text='${text}':fontsize=44:fontcolor=yellow:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h-120:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
        }).join(',')
      
      if (drawTexts) {
        const currentFilter = filterArgs.length > 0 ? filterArgs[1] + ',' : ''
        filterArgs = ['-vf', currentFilter + drawTexts]
      }
    }

    console.log('Final FFmpeg Filter Args:', filterArgs)

    await ffmpeg.exec([
      '-i', inputName,
      '-ss', formatTime(startTimeSec),
      '-to', formatTime(endTimeSec),
      ...filterArgs,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      outputName
    ])

    const data = await ffmpeg.readFile(outputName)
    // Uint8Arrayを直接渡してバイナリコピーを確実に行う（SharedArrayBuffer由来の不具合回避）
    const blob = new Blob([data], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
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

              <div className="feature-toggle">
                <label className="switch-label">
                  <input 
                    type="checkbox" 
                    checked={isVertical} 
                    onChange={(e) => setIsVertical(e.target.checked)} 
                  />
                  <span className="switch-text">📱 TikTok/Shorts向けに縦動画(9:16)にする</span>
                </label>
              </div>

              <div className="feature-toggle transcription-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: transcriptionStatus ? '12px' : '0' }}>
                  <label className="switch-label">
                    <input 
                      type="checkbox" 
                      checked={transcribeEnabled} 
                      onChange={(e) => setTranscribeEnabled(e.target.checked)} 
                    />
                    <span className="switch-text">🤖 AI自動文字起こし & 字幕を入れる</span>
                  </label>
                  {transcribeEnabled && !captions.length && (
                    <button className="btn-small" onClick={transcribeAudio}>解析開始</button>
                  )}
                </div>
                {transcriptionStatus && (
                  <div className="transcription-status">
                    <span className="pulse-dot"></span> {transcriptionStatus}
                  </div>
                )}
                {captions.length > 0 && transcribeEnabled && (
                  <div className="caption-preview">
                    {captions.slice(0, 3).map((c, i) => (
                      <div key={i} className="caption-tag">{c.text}</div>
                    ))}
                    {captions.length > 3 && <span>...</span>}
                  </div>
                )}
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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary" 
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    動画をダウンロード
                  </a>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
                    ※iPhoneでダウンロードできない場合は、動画を長押しして「保存」または「共有」から保存してください
                  </p>
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
