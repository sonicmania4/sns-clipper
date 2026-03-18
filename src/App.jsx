import { useState, useRef, useEffect } from 'react'
import './index.css'

function App() {
  const [loaded, setLoaded] = useState(true)
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
  
  const [captionStyle, setCaptionStyle] = useState('classic')
  
  const videoRef = useRef(null)


  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setVideoFile(file)
      setOutputUrl(null)
      setCaptions([])
      setTranscriptionStatus('')
      setServerFilename(null)
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

  const [serverFilename, setServerFilename] = useState(null)

  const uploadWithProgress = (file) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('video', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setProgress(percent)
          setTranscriptionStatus(`アップロード中... ${percent}%`)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          reject(new Error('アップロード失敗'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))
      xhr.open('POST', 'http://localhost:3001/api/upload')
      xhr.send(formData)
    })
  }

  const transcribeAudio = async () => {
    if (!videoFile) return
    setTranscriptionStatus('音声解析の準備中...')
    setCaptions([])
    setProgress(0)
    
    try {
      let filename = serverFilename
      
      if (!filename) {
        const data = await uploadWithProgress(videoFile)
        filename = data.filename
        setServerFilename(filename)
      }

      setTranscriptionStatus('サーバーでAI文字起こしを実行中... (数分かかる場合があります)')
      const transcribeRes = await fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      })

      if (!transcribeRes.ok) throw new Error('文字起こしに失敗しました。ファイルが大きすぎる可能性があります。')
      const { chunks } = await transcribeRes.json()

      const cleanChunks = chunks
        .filter(c => c.text.trim())
        .map(c => ({ ...c, text: c.text.trim() }))
      
      setCaptions(cleanChunks)
      setTranscriptionStatus('文字起こし完了！(テロップを編集できます)')

    } catch (err) {
      console.error('Transcription error:', err)
      setTranscriptionStatus(`エラー: ${err.message}`)
    } finally {
      setProgress(100)
    }
  }

  const updateCaption = (index, newText) => {
    const updated = [...captions]
    updated[index].text = newText
    setCaptions(updated)
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
      setCaptions([])
      setTranscriptionStatus('')
      setServerFilename(null)
    }
  }

  const transcode = async () => {
    if (!videoFile) return
    setProcessing(true)
    setProgress(0)
    setTranscriptionStatus('準備中...')

    try {
      let filename = serverFilename
      
      if (!filename) {
        const data = await uploadWithProgress(videoFile)
        filename = data.filename
        setServerFilename(filename)
      }

      setTranscriptionStatus('サーバーで動画を書き出し中... (高画質レンダリングを実行しています)')
      const processRes = await fetch('http://localhost:3001/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          startTime: startTimeSec,
          endTime: endTimeSec,
          isVertical,
          captions: transcribeEnabled ? captions : [],
          captionStyle
        })
      })

      if (!processRes.ok) {
        const errorText = await processRes.text()
        throw new Error(`サーバー処理エラー: ${errorText || '不明なエラー'}`)
      }
      const { outputUrl } = await processRes.json()

      setOutputUrl(outputUrl)
      setTranscriptionStatus('処理完了！(動画を保存できます)')
    } catch (err) {
      console.error('Processing error:', err)
      setTranscriptionStatus(`エラー: ${err.message}`)
    } finally {
      setProcessing(false)
      setProgress(100)
    }
  }

  return (
    <div className="container">
      <header>
        <h1 className="neon-title">SNS CLIPPER</h1>
        <p className="subtitle">爆速。無劣化。切り抜き動画の革命。</p>
      </header>

      <div className="flex justify-center mb-8">
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <a
            href="https://px.a8.net/svt/ejp?a8mat=4AZHWD+DGMV76+1WP2+6F9M9"
            rel="nofollow noopener noreferrer"
            target="_blank"
          >
            <img
              border="0"
              width="165"
              height="120"
              alt=""
              src="https://www27.a8.net/svt/bgt?aid=260317021814&wid=001&eno=01&mid=s00000008903001079000&mc=1"
              style={{ borderRadius: '8px' }}
            />
          </a>
          <img
            border="0"
            width="1"
            height="1"
            src="https://www11.a8.net/0.gif?a8mat=4AZHWD+DGMV76+1WP2+6F9M9"
            alt=""
            style={{ position: 'absolute', opacity: 0 }}
          />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>ADVERTISEMENT</span>
        </div>
      </div>

      <main 
        className={`glass-panel ${dragActive ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!videoFile ? (
          <div className="dropzone-container">
            <label className="dropzone">
              <input type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
              <div className="dropzone-text">
                <span style={{ fontSize: '3rem' }}>📁</span>
                <h3 style={{ marginTop: '16px' }}>動画ファイルをアップロード</h3>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (transcriptionStatus || captions.length > 0) ? '20px' : '0' }}>
                  <label className="switch-label">
                    <input 
                      type="checkbox" 
                      checked={transcribeEnabled} 
                      onChange={(e) => setTranscribeEnabled(e.target.checked)} 
                    />
                    <span className="switch-text">🤖 AI自動文字起こし & 字幕</span>
                  </label>
                  {transcribeEnabled && !captions.length && (
                    <button className="btn-small" onClick={transcribeAudio}>解析開始 (サーバーAI)</button>
                  )}
                </div>
                
                {transcriptionStatus && (
                  <div className="transcription-status">
                    <span className="pulse-dot"></span> {transcriptionStatus}
                  </div>
                )}

                {captions.length > 0 && transcribeEnabled && (
                  <div className="caption-editor">
                    <h4 style={{ marginBottom: '16px', color: 'var(--accent-color)' }}>字幕スタイル選択</h4>
                    <div className="style-selector">
                      {[
                        { id: 'classic', name: 'Classic', previewColor: 'preview-classic' },
                        { id: 'premium', name: 'Premium', previewColor: 'preview-premium' },
                        { id: 'neon', name: 'Neon', previewColor: 'preview-neon' },
                        { id: 'impact', name: 'Impact', previewColor: 'preview-impact' }
                      ].map(style => (
                        <label key={style.id} className="style-option">
                          <input 
                            type="radio" 
                            name="captionStyle" 
                            value={style.id} 
                            checked={captionStyle === style.id}
                            onChange={(e) => setCaptionStyle(e.target.value)}
                          />
                          <div className="style-card">
                            <span className={`style-preview ${style.previewColor}`}>ABC</span>
                            <span className="style-name">{style.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <h4 style={{ margin: '24px 0 12px', color: 'var(--accent-color)' }}>字幕テキストの編集</h4>
                    <div className="caption-list">
                      {captions.map((c, i) => (
                        <div key={i} className="caption-item">
                          <div className="caption-time">
                            {c.timestamp[0].toFixed(1)}s - {(c.timestamp[1] || c.timestamp[0] + 2).toFixed(1)}s
                          </div>
                          <input 
                            type="text" 
                            className="caption-input"
                            value={c.text}
                            onChange={(e) => updateCaption(i, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
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
                  <p style={{ textAlign: 'center', marginTop: '12px', fontWeight: 'bold' }}>処理中... {progress}%</p>
                  <div className="log-box">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                </div>
              )}

              {outputUrl && (
                <div className="output-container glass-panel" style={{ marginTop: '20px', background: 'rgba(0, 242, 255, 0.05)' }}>
                  <h3 style={{ marginBottom: '16px', textAlign: 'center' }}>✨ 動画が完成しました！</h3>
                  <video src={outputUrl} controls style={{ marginBottom: '20px' }} />
                  
                  <a 
                    href={outputUrl} 
                    download="clipped_video.mp4" 
                    className="btn-primary" 
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    動画を保存する
                  </a>
                  <button 
                    onClick={() => { setOutputUrl(null); setVideoFile(null); }} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', width: '100%', marginTop: '16px', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    別の動画を編集する
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: '60px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <p>© 2026 SNS Clipper Pro - Local Backend Mode</p>
        <p style={{ marginTop: '4px' }}>長尺動画対応：ローカルサーバーで高速かつ安定した処理（AI文字起こし・編集）を実行中。</p>
      </footer>
    </div>
  )
}

export default App
