class OutputRouter extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0] ?? [];
    const output = outputs[0];
    if (!output) return true;
    for (let channel = 0; channel < output.length; channel++) {
      const target = output[channel];
      const source = input[channel];
      if (!target) continue;
      if (source && source.length === target.length) target.set(source);
      else target.fill(0);
    }
    return true;
  }
}

registerProcessor("output-router", OutputRouter);
