import { getSetting, setSetting, type Db } from './db';

export interface OverlayAudioSettings {
  soundEnabled: boolean;
  ttsEnabled: boolean;
}

export async function getOverlayAudioSettings(db: Db): Promise<OverlayAudioSettings> {
  const [sound, tts] = await Promise.all([
    getSetting(db, 'overlay_sound_enabled'),
    getSetting(db, 'overlay_tts_enabled'),
  ]);
  return {
    soundEnabled: sound !== 'false',
    ttsEnabled: tts !== 'false',
  };
}

export async function saveOverlayAudioSettings(db: Db, settings: OverlayAudioSettings): Promise<OverlayAudioSettings> {
  await Promise.all([
    setSetting(db, 'overlay_sound_enabled', settings.soundEnabled ? 'true' : 'false'),
    setSetting(db, 'overlay_tts_enabled', settings.ttsEnabled ? 'true' : 'false'),
  ]);
  return settings;
}
