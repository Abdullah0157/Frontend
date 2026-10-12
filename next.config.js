/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Site numbers live on the admin Home now (login + super-admin role); the
      // old Analytics and Skills pages were folded in or retired.
      { source: '/analytics', destination: '/admin', permanent: false },
      { source: '/admin/analytics', destination: '/admin', permanent: false },
      { source: '/admin/skills', destination: '/admin', permanent: false },
      // Company accounts are invite-only; companies ask through the contact page.
      { source: '/signup/company', destination: '/contact', permanent: false },
    ]
  },
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
