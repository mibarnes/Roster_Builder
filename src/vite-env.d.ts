/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'bundled' (pre-collected per-team JSON) | 'mock'. Defaults to 'bundled'. */
  readonly VITE_DATA_MODE?: 'bundled' | 'mock'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
