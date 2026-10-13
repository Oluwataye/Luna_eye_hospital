"""
Local Whisper Microservice for VisionCare EMR
Luna Eye Hospital, Minna
Runs faster-whisper locally with CPU (int8) or NVIDIA GPU / CUDA (float16).
Supports dynamic model switching, hardware auto-detection, and live WebSocket streaming transcription.
Zero external network calls required once models are cached.
"""

import os
import sys
import tempfile
import base64
import re
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

app = Flask(__name__)

PORT = 8765
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_DIR = os.path.join(SCRIPT_DIR, "models", "base.en")
MODEL_PATH = os.environ.get("WHISPER_MODEL", DEFAULT_MODEL_DIR if os.path.exists(DEFAULT_MODEL_DIR) else "base.en")

current_model_name = "base.en"
current_device = "cpu"
current_compute_type = "int8"
model = None

def get_hardware_info():
    """Detect local GPU capabilities using ctranslate2."""
    cuda_avail = False
    cuda_count = 0
    gpu_name = "None (CPU Execution)"
    try:
        import ctranslate2
        cuda_count = ctranslate2.get_cuda_device_count()
        cuda_avail = cuda_count > 0
        if cuda_avail:
            gpu_name = f"NVIDIA CUDA Accelerator ({cuda_count} Device{'s' if cuda_count > 1 else ''})"
    except Exception:
        pass

    return {
        "cuda_available": cuda_avail,
        "cuda_device_count": cuda_count,
        "gpu_name": gpu_name,
        "current_device": current_device,
        "current_compute_type": current_compute_type,
        "supported_devices": ["auto", "cpu"] + (["cuda"] if cuda_avail else []),
        "supported_compute_types": ["auto", "int8"] + (["float16", "int8_float16"] if cuda_avail else [])
    }

def clean_clinical_text(text: str) -> str:
    """Lightweight rule-based formatting for spoken dictation."""
    if not text:
        return ""
    
    replacements = [
        (r'\b(period|full stop)\b', '.'),
        (r'\b(comma)\b', ','),
        (r'\b(colon)\b', ':'),
        (r'\b(semicolon)\b', ';'),
        (r'\b(question mark)\b', '?'),
        (r'\b(new line|next line)\b', '\n'),
        (r'\b(new paragraph)\b', '\n\n'),
    ]
    cleaned = text
    for pattern, rep in replacements:
        cleaned = re.sub(pattern, rep, cleaned, flags=re.IGNORECASE)
    
    cleaned = re.sub(r'\s+([,.:;?!])', r'\1', cleaned)
    cleaned = re.sub(r'([,.:;?!])(?=[^\s\d])', r'\1 ', cleaned)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    
    sentences = re.split(r'([.?!]\s+)', cleaned)
    capitalized = []
    for s in sentences:
        if s and not re.match(r'^[.?!]\s+$', s):
            s = s[0].upper() + s[1:] if len(s) > 1 else s.upper()
        capitalized.append(s)
    
    return "".join(capitalized).strip()

def load_engine(model_target: str, device: str = "auto", compute_type: str = "auto"):
    """Loads faster-whisper model with automatic hardware acceleration fallback."""
    global model, current_model_name, current_device, current_compute_type
    
    hw = get_hardware_info()
    local_dir = os.path.join(SCRIPT_DIR, "models", model_target)
    model_source = local_dir if os.path.exists(local_dir) and os.path.exists(os.path.join(local_dir, "model.bin")) else model_target
    
    resolved_device = device
    resolved_compute = compute_type
    
    if resolved_device == "auto":
        resolved_device = "cuda" if hw["cuda_available"] else "cpu"
    if resolved_compute == "auto":
        resolved_compute = "float16" if resolved_device == "cuda" else "int8"
        
    print(f"[Whisper] Attempting to load model '{model_target}' on {resolved_device} ({resolved_compute})...")
    
    try:
        new_model = WhisperModel(model_source, device=resolved_device, compute_type=resolved_compute)
        model = new_model
        current_model_name = model_target
        current_device = resolved_device
        current_compute_type = resolved_compute
        print(f"[Whisper] Successfully loaded model '{model_target}' on {current_device} ({current_compute_type}).")
        return True, None
    except Exception as err:
        print(f"[Whisper Warning] Failed on {resolved_device} ({resolved_compute}): {err}")
        if resolved_device == "cuda":
            print("[Whisper Fallback] Falling back to CPU with int8 quantization...")
            try:
                new_model = WhisperModel(model_source, device="cpu", compute_type="int8")
                model = new_model
                current_model_name = model_target
                current_device = "cpu"
                current_compute_type = "int8"
                print(f"[Whisper] Successfully loaded model '{model_target}' on CPU fallback.")
                return True, f"Fell back to CPU: {err}"
            except Exception as cpu_err:
                return False, str(cpu_err)
        return False, str(err)

# Initial load on startup
load_engine(current_model_name, "auto", "auto")

@app.route("/health", methods=["GET"])
def health():
    models_dir = os.path.join(SCRIPT_DIR, "models")
    available = []
    if os.path.exists(models_dir):
        for name in os.listdir(models_dir):
            p = os.path.join(models_dir, name)
            if os.path.isdir(p) and os.path.exists(os.path.join(p, "model.bin")):
                available.append(name)
    return jsonify({
        "status": "ok" if model is not None else "model_not_loaded",
        "current_model": current_model_name,
        "available_models": available,
        "engine": "faster-whisper",
        "device": current_device,
        "compute_type": current_compute_type,
        "hardware": get_hardware_info()
    })

@app.route("/models", methods=["GET"])
def list_models():
    models_dir = os.path.join(SCRIPT_DIR, "models")
    available = []
    if os.path.exists(models_dir):
        for name in os.listdir(models_dir):
            p = os.path.join(models_dir, name)
            if os.path.isdir(p) and os.path.exists(os.path.join(p, "model.bin")):
                available.append(name)
    return jsonify({
        "current_model": current_model_name,
        "current_device": current_device,
        "current_compute_type": current_compute_type,
        "available_models": available,
        "supported_models": ["tiny.en", "base.en", "small.en"],
        "hardware": get_hardware_info()
    })

@app.route("/switch-model", methods=["POST"])
def switch_model():
    data = request.get_json() or {}
    target_model = data.get("model", current_model_name)
    device = data.get("device", current_device)
    compute_type = data.get("compute_type", current_compute_type)
    
    success, notice = load_engine(target_model, device, compute_type)
    if success:
        return jsonify({
            "status": "ok",
            "current_model": current_model_name,
            "current_device": current_device,
            "current_compute_type": current_compute_type,
            "notice": notice,
            "hardware": get_hardware_info()
        })
    else:
        return jsonify({"error": notice or "Failed to load model"}), 500

@app.route("/stream-transcribe", methods=["POST"])
def stream_transcribe():
    """Fast low-latency transcription for live streaming WebSocket chunks."""
    if model is None:
        return jsonify({"error": "Whisper model not initialized"}), 500

    temp_path = None
    try:
        audio_path = None
        if "audio" in request.files:
            file = request.files["audio"]
            ext = os.path.splitext(file.filename or "")[1] or ".webm"
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            os.close(fd)
            file.save(temp_path)
            audio_path = temp_path
        elif request.is_json:
            data = request.get_json() or {}
            if "audio_path" in data and os.path.exists(data["audio_path"]):
                audio_path = data["audio_path"]
            elif "audio_b64" in data and data["audio_b64"]:
                raw_b64 = data["audio_b64"]
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                audio_bytes = base64.b64decode(raw_b64)
                fd, temp_path = tempfile.mkstemp(suffix=".webm")
                os.close(fd)
                with open(temp_path, "wb") as f:
                    f.write(audio_bytes)
                audio_path = temp_path

        if not audio_path or not os.path.exists(audio_path):
            return jsonify({"error": "No valid audio provided"}), 400

        # Fast live stream settings: beam_size=1, temperature=0, condition_on_previous_text=False
        segments, info = model.transcribe(
            audio_path,
            language="en",
            beam_size=1,
            temperature=0.0,
            best_of=1,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400)
        )

        texts = [s.text.strip() for s in segments if s.text.strip()]
        raw_text = " ".join(texts).strip()
        formatted_text = clean_clinical_text(raw_text)

        return jsonify({
            "text": raw_text,
            "raw_transcript": raw_text,
            "processed_note": formatted_text,
            "duration": round(info.duration, 2) if info else 0
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.route("/transcribe", methods=["POST"])
def transcribe():
    if model is None:
        return jsonify({"error": "Whisper model not initialized"}), 500

    temp_path = None
    try:
        audio_path = None
        
        if "audio" in request.files:
            file = request.files["audio"]
            ext = os.path.splitext(file.filename or "")[1] or ".webm"
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            os.close(fd)
            file.save(temp_path)
            audio_path = temp_path
        elif request.is_json:
            data = request.get_json() or {}
            if "audio_path" in data and os.path.exists(data["audio_path"]):
                audio_path = data["audio_path"]
            elif "audio_b64" in data and data["audio_b64"]:
                raw_b64 = data["audio_b64"]
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                audio_bytes = base64.b64decode(raw_b64)
                fd, temp_path = tempfile.mkstemp(suffix=".webm")
                os.close(fd)
                with open(temp_path, "wb") as f:
                    f.write(audio_bytes)
                audio_path = temp_path

        if not audio_path or not os.path.exists(audio_path):
            return jsonify({"error": "No valid audio provided (audio file, audio_path, or audio_b64 required)"}), 400

        segments, info = model.transcribe(
            audio_path,
            language="en",
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        segment_list = []
        full_text_parts = []
        for segment in segments:
            text = segment.text.strip()
            if text:
                full_text_parts.append(text)
                segment_list.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": text
                })

        raw_text = " ".join(full_text_parts).strip()
        formatted_text = clean_clinical_text(raw_text)

        return jsonify({
            "raw_transcript": raw_text,
            "processed_note": formatted_text,
            "duration": round(info.duration, 2) if info else 0,
            "language": info.language if info else "en",
            "segments": segment_list
        })

    except Exception as e:
        print(f"[Whisper Error] Transcription failed: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

if __name__ == "__main__":
    print(f"[Whisper] Starting local Whisper service on http://127.0.0.1:{PORT}")
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
