import nextConfig from 'eslint-config-next';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      '.superpowers/**',
    ],
  },
  ...nextConfig,
];

export default config;
