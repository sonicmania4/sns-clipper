import { useState, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import './index.css'

const ffmpeg = new FFmpeg()

function App() {
  const [loaded, setLoaded] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [startTimeSec, setStartTimeSec] = useState(0)
  const [endTimeSec, setEndTimeSec] = useState(10)
  const [videoUrl, setVideoUrl] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [isVertical, setIsVertical] = useState(false)
  const [transcriptionStatus, setTranscriptionStatus] = useState('')
  const [captions, setCaptions] = useState([])
  const [captionStyle, setCaptionStyle] = useState('classic')

  const videoRef = useRef(null)

  // Load FFmpeg on mount
  useEffect(() => {
    const load = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
        ffmpeg.on('log', ({ message }) => console.log(message))
        ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        setLoaded(true)
      } catch (e) {
        console.error('FFmpeg load error:', e)
        setLoaded(true) // allow UI even if FFmpeg fails
      }
    }
    load()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    loadFile(file)
  }

  const loadFile = (file) => {
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setVideoFile(file)
    setOutputUrl(null)
    setCaptions([])
    setTranscriptionStatus('')
    setStartTimeSec(0)
    setEndTimeSec(10)
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration
      setDuration(dur)
      setEndTimeSec(Math.min(dur, 60))
    }
  }

  const formatTime = (seconds) => {
    const d = new Date(0)
    d.setSeconds(seconds)
    return d.toISOString().substr(11, 8)
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
    if (file && file.type.startsWith('video/')) loadFile(file)
  }

  const updateCaption = (index, newText) => {
    const updated = [...captions]
    updated[index].text = newText
    setCaptions(updated)
  }

  const transcode = async () => {
    if (!videoFile || !loaded) return
    setProcessing(true)
    setProgress(0)
    setTranscriptionStatus('処理中...')

    try {
      const inputName = 'input.mp4'
      const outputName = 'output.mp4'

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile))

      const args = [
        '-i', inputName,
        '-ss', String(startTimeSec),
        '-to', String(endTimeSec),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ]

      if (isVertical) {
        args.push('-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black')
      }

      args.push(outputName)

      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      setTranscriptionStatus('処理完了！')
    } catch (err) {
      console.error('Processing error:', err)
      setTranscriptionStatus(`エラー: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="container">
      <header>
        <h1 className="neon-title">SNS CLIPPER</h1>
        <p className="subtitle">爆速。無劣化。切り抜き動画の革命。</p>
      </header>

      {/* ── Top DMM FX Banner ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <a
            href="https://px.a8.net/svt/ejp?a8mat=4AZHWD+DGMV76+1WP2+6F9M9"
            rel="nofollow noopener noreferrer"
            target="_blank"
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                width: '165px', height: '120px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '10px', cursor: 'pointer', transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(15,52,96,0.5)',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.04)' }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <img
                src="https://www27.a8.net/svt/bgt?aid=260317021814&wid=001&eno=01&mid=s00000008903001079000&mc=1"
                alt="" width="165" height="120"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
              />
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#fff', position: 'relative', zIndex: 1, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>DMM FX</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', background: 'rgba(0,0,0,0.55)', padding: '3px 12px', borderRadius: '20px', position: 'relative', zIndex: 1 }}>
                FX取引を始める
              </span>
            </div>
          </a>
          <img border="0" width="1" height="1" src="https://www11.a8.net/0.gif?a8mat=4AZHWD+DGMV76+1WP2+6F9M9" alt="" style={{ position: 'absolute', opacity: 0 }} />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>PR</span>
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
                <p>またはここにファイルをドラッグ＆ドロップ</p>
                {!loaded && <p style={{ marginTop: '12px', color: 'var(--accent-color)', fontSize: '0.85rem' }}>⚙️ FFmpegエンジン読み込み中...</p>}
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
                <p style={{ textAlign: 'center', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.9rem', marginTop: '4px' }}>
                  クリップ長さ: {formatTime(endTimeSec - startTimeSec)}
                </p>
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

              {transcriptionStatus && (
                <div className="transcription-status">
                  <span className="pulse-dot"></span> {transcriptionStatus}
                </div>
              )}

              {!processing && !outputUrl && (
                <button
                  className="btn-primary"
                  onClick={transcode}
                  disabled={!loaded}
                >
                  {loaded ? '✂️ 切り抜きを開始する' : '⚙️ エンジン起動中...'}
                </button>
              )}

              {processing && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '12px', fontWeight: 'bold' }}>処理中... {progress}%</p>
                </div>
              )}

              {outputUrl && (
                <div className="glass-panel" style={{ marginTop: '20px', background: 'rgba(0, 242, 255, 0.05)' }}>
                  <h3 style={{ marginBottom: '16px', textAlign: 'center' }}>✨ 動画が完成しました！</h3>
                  <video src={outputUrl} controls style={{ marginBottom: '20px', width: '100%', borderRadius: '12px' }} />
                  <a
                    href={outputUrl}
                    download="snipped.mp4"
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    動画を保存する
                  </a>
                  <button
                    onClick={() => { setOutputUrl(null); setVideoFile(null); setVideoUrl(null) }}
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

      {/* ── Leaderboard Banner ── */}
      <div style={{ margin: '40px 0', textAlign: 'center' }}>
        <a
          href="https://px.a8.net/svt/ejp?a8mat=4AZHWD+DHTQEQ+50+2HV61T"
          rel="nofollow noopener noreferrer"
          target="_blank"
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <div
            style={{
              position: 'relative', overflow: 'hidden',
              maxWidth: '728px', width: '100%', height: '90px',
              margin: '0 auto', borderRadius: '12px',
              background: 'linear-gradient(135deg, #0a0a1a, #0d1b4b, #1a0a3d)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.01)' }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            {/* A8 image overlay */}
            <img
              src="https://www27.a8.net/svt/bgt?aid=260317021816&wid=001&eno=01&mid=s00000000018015094000&mc=1"
              alt="" width="728" height="90"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
            />
            {/* Fallback content (always visible underneath image overlay) */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: '4px', textTransform: 'uppercase' }}>PR</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>A8.net アフィリエイト広告</p>
            </div>
            <span style={{
              position: 'relative', zIndex: 1,
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', fontWeight: 700, fontSize: '13px',
              padding: '8px 20px', borderRadius: '30px',
              backdropFilter: 'blur(4px)',
            }}>
              詳しくはこちら →
            </span>
          </div>
        </a>
        <img border="0" width="1" height="1" src="https://www11.a8.net/0.gif?a8mat=4AZHWD+DHTQEQ+50+2HV61T" alt="" style={{ position: 'absolute', opacity: 0 }} />

      </div>

      {/* ── Footer Sponsor Section ── */}
      <footer style={{ marginTop: '60px' }}>
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '40px',
          paddingBottom: '40px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: '24px',
          }}>
            スポンサーリンク
          </p>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '40px',
          }}>
            {/* DMM FX */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <a
                href="https://px.a8.net/svt/ejp?a8mat=4AZHWD+DGMV76+1WP2+6F9M9"
                rel="nofollow noopener noreferrer"
                target="_blank"
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    width: '165px', height: '120px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', cursor: 'pointer', transition: 'all 0.2s',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(15,52,96,0.4)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.03)' }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <img
                    src="https://www27.a8.net/svt/bgt?aid=260317021814&wid=001&eno=01&mid=s00000008903001079000&mc=1"
                    alt="" width="165" height="120"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                  />
                  <span style={{ fontSize: '20px', fontWeight: 900, color: '#fff', position: 'relative', zIndex: 1, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>DMM FX</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.5)', padding: '3px 10px', borderRadius: '20px', position: 'relative', zIndex: 1 }}>
                    FX取引を始める
                  </span>
                </div>
              </a>
              <img border="0" width="1" height="1" src="https://www11.a8.net/0.gif?a8mat=4AZHWD+DGMV76+1WP2+6F9M9" alt="" style={{ position: 'absolute', opacity: 0 }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>DMM FX</span>
            </div>

            {/* moomoo証券 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <a href="https://j.jp.moomoo.com/0ACr1m" rel="noopener noreferrer" target="_blank" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    width: '165px', height: '120px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 20px rgba(249,115,22,0.25)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.03)' }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#fff' }}>moomoo</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.25)', padding: '3px 10px', borderRadius: '20px' }}>
                    moomoo証券で投資を始める
                  </span>
                </div>
              </a>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>moomoo証券</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: '40px' }}>
          <p>© 2026 SNS Clipper Pro · ブラウザ内FFmpeg処理 · プライバシー安心</p>
        </div>
      </footer>
    </div>
  )
}

export default App
