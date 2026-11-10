// Deklarasi lokal agar impor `?url` Vite dikenali tanpa mengubah file tsconfig bersama.
declare module '*.mjs?url' {
  const url: string;
  export default url;
}

// Build browser Mammoth yang sudah ter-bundle: kode identik di browser, Vitest, dan produksi,
// serta tidak menarik modul khusus Node. Tipe diambil dari paket utama.
declare module 'mammoth/mammoth.browser.min.js' {
  import mammoth from 'mammoth';
  export default mammoth;
}
