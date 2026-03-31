import type { WireDisplaySettings } from '../shared/protocol.js';
import type { DisplaySettings } from '../config/types.js';
import type { ExtensionToWebviewMessage } from '../shared/protocol.js';

export type PostMessageCallback = (message: ExtensionToWebviewMessage) => void;
export type SessionRef = { displaySettings?: DisplaySettings };

export class DisplayConfigService {
  private sessionRef?: SessionRef;

  setSessionRef(session: SessionRef): void {
    this.sessionRef = session;
  }

  updateDisplaySettings(settings: WireDisplaySettings): void {
    if (this.sessionRef) {
      this.sessionRef.displaySettings = settings as DisplaySettings;
    }
  }

  getSessionDisplaySettings(): DisplaySettings | undefined {
    return this.sessionRef?.displaySettings;
  }
}
