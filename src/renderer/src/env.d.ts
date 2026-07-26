/// <reference types="vite/client" />

import type { ServilionBridge } from "../../preload";

// El puente que el preload expone con `contextBridge`. Es todo lo que el
// renderer puede tocar fuera de su propio sandbox.
declare global {
  interface Window {
    servilion: ServilionBridge;
  }
}

export {};
