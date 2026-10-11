/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The site statistics page is for admins (login + super-admin role); the
      // old public copy read from a backend that no longer exists.
      { source: '/analytics', destination: '/admin/analytics', permanent: false },
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
