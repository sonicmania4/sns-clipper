import { pipeline, env } from '@xenova/transformers';

// WASMの場所をローカルまたはCDNに設定（Vite環境用）
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.onmessage = async (e) => {
    const { audio, language = 'ja' } = e.data;

    try {
        if (!transcriber) {
            self.postMessage({ status: 'loading', message: 'AIモデルをロード中...' });
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                progress_callback: (p) => {
                    if (p.status === 'progress') {
                        self.postMessage({ 
                            status: 'loading', 
                            message: `AIモデルをダウンロード中... ${Math.round(p.progress)}%` 
                        });
                    }
                }
            });
            self.postMessage({ status: 'ready', message: 'モデルの準備が整いました' });
        }

        self.postMessage({ status: 'processing', message: '音声解析中...' });
        
        const result = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: language,
            task: 'transcribe',
            return_timestamps: true,
        });

        self.postMessage({ status: 'done', result });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
};
