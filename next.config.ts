import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Mantener true hasta reducir warnings; el build falla si hay errores de ESLint
    ignoreDuringBuilds: true,
  },
  turbopack: {
    resolveAlias: {
      '@mediapipe/pose': path.resolve(__dirname, 'shims/mediapipe-pose-shim.js'),
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '300mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Configuración para el lado del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        canvas: false,
      };
    }
    
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { "onnxruntime-node": "commonjs onnxruntime-node" },
      ];
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Resolver problemas con Konva
    config.resolve.alias = {
      ...config.resolve.alias,
      'canvas': false,
      '@mediapipe/pose': path.resolve(__dirname, 'shims/mediapipe-pose-shim.js'),
    };
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
                     {
             key: 'Content-Security-Policy',
             value: [
               "default-src 'self'",
               "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:9999 https://localhost:9999",
               "script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:9999 https://localhost:9999",
               "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
               "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
               "img-src 'self' data: https: blob:",
               "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https: wss: http://localhost:9999 https://localhost:9999 https://unpkg.com",
               "media-src 'self' https: blob:",
              "worker-src 'self' blob: https://unpkg.com",
               "object-src 'none'",
               "base-uri 'self'",
               "form-action 'self'",
               "frame-ancestors 'none'",
               "worker-src 'self' blob:",
               "child-src 'self' blob:",
             ].join('; '),
           },
        ],
      },
    ];
  },
};

export default nextConfig;
