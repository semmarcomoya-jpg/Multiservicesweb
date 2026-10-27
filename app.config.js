// Configuración dinámica: en GitHub Pages la app vive en /<nombre-del-repo>
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || '' },
});
