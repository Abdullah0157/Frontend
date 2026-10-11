/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'logo.clearbit.com'], // For mock images
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist', 'msedge-tts', 'ws', 'bufferutil', 'utf-8-validate',
      // Code sandbox for written assessments: loads a .wasm file at runtime.
      'quickjs-emscripten', 'quickjs-emscripten-core', '@jitl/quickjs-wasmfile-release-sync', 'sucrase'],
    outputFileTracingIncludes: {
      '/api/upload-resume': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    },
  },
}

module.exports = nextConfig
