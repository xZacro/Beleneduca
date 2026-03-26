/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_FNI_DATA_SOURCE?: "api";
  readonly VITE_AUTH_SOURCE?: "api";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
