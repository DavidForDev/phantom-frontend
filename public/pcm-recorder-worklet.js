// AudioWorklet that downsamples mono Float32 input to 16kHz Int16 PCM
// and posts ArrayBuffer chunks to the main thread.
class PCMRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.inputRate = sampleRate;
    this.ratio = this.inputRate / this.targetRate;
    this.acc = [];
    this.accLength = 0;
    this.frameSize = 1600; // 100ms at 16kHz
  }

  downsample(input) {
    const outLength = Math.floor(input.length / this.ratio);
    const out = new Float32Array(outLength);
    let inIdx = 0;
    for (let i = 0; i < outLength; i++) {
      const nextIdx = Math.round((i + 1) * this.ratio);
      let sum = 0;
      let count = 0;
      for (let j = inIdx; j < nextIdx && j < input.length; j++) {
        sum += input[j];
        count++;
      }
      out[i] = count > 0 ? sum / count : 0;
      inIdx = nextIdx;
    }
    return out;
  }

  floatToPCM(floats) {
    const pcm = new Int16Array(floats.length);
    for (let i = 0; i < floats.length; i++) {
      const s = Math.max(-1, Math.min(1, floats[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    const downsampled = this.downsample(channel);
    this.acc.push(downsampled);
    this.accLength += downsampled.length;

    while (this.accLength >= this.frameSize) {
      const merged = new Float32Array(this.accLength);
      let offset = 0;
      for (const chunk of this.acc) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const frame = merged.subarray(0, this.frameSize);
      const remainder = merged.subarray(this.frameSize);
      this.acc = remainder.length > 0 ? [remainder] : [];
      this.accLength = remainder.length;

      const pcm = this.floatToPCM(frame);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-recorder", PCMRecorder);
