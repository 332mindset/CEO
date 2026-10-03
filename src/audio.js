// Local Web Audio synthesis: no media requests, no playback before opt-in.
export function createWorkshopAudio() {
  let context, master, servo, enabled = false, started = false;
  async function setEnabled(value) {
    if (value && !context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      context = new Audio(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      for (const [frequency, volume] of [[48,.16],[96,.035],[144,.012]]) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = volume;
        oscillator.connect(gain).connect(master); oscillator.start();
      }
      const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), values = noise.getChannelData(0);
      for (let i=0;i<values.length;i++) values[i]=(Math.random()-.5)*.15;
      const source = context.createBufferSource(), filter = context.createBiquadFilter(); source.buffer=noise; source.loop=true;
      filter.type='lowpass'; filter.frequency.value=260; source.connect(filter).connect(master); source.start();
      const motor=context.createOscillator(); servo=context.createGain(); motor.type='sine'; motor.frequency.value=185; servo.gain.value=0; motor.connect(servo).connect(master); motor.start(); started=true;
    }
    enabled=value;
    if (!context) return enabled;
    if (value) await context.resume();
    master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(value ? .12 : 0,context.currentTime,.14);
    return enabled;
  }
  function signal() {
    if (!enabled || !started || document.hidden) return;
    const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    oscillator.type='sine'; oscillator.frequency.setValueAtTime(690,now); oscillator.frequency.exponentialRampToValueAtTime(940,now+.13);
    gain.gain.setValueAtTime(0,now); gain.gain.linearRampToValueAtTime(.07,now+.025); gain.gain.exponentialRampToValueAtTime(.001,now+.22);
    oscillator.connect(gain).connect(master); oscillator.start(); oscillator.stop(now+.24);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }
  function motion() {
    if (!enabled || !servo) return;
    const now=context.currentTime; servo.gain.cancelScheduledValues(now); servo.gain.setTargetAtTime(.025,now,.06); servo.gain.setTargetAtTime(0,now+.14,.18);
  }
  const visibility=()=>{if(!context)return;if(document.hidden)context.suspend();else if(enabled)context.resume().catch(()=>{});};
  document.addEventListener('visibilitychange',visibility);
  return {setEnabled,signal,motion,dispose(){document.removeEventListener('visibilitychange',visibility);context?.close();}};
}
