import type { BgMessage, BgResponse } from './types';

export function sendMessage<T = unknown>(msg: BgMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: BgResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response.success) {
        reject(new Error(response.error ?? 'Unknown error'));
        return;
      }
      resolve(response.data as T);
    });
  });
}
