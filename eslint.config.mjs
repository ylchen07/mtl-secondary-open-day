import nextConfig from 'eslint-config-next';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      '.superpowers/**',
      '.open-next/**',
      '.wrangler/**',
    ],
  },
  ...nextConfig,
];

export default config;
