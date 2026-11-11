// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Setup health endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }
      setupHealthEndpoints(devServer, healthPluginInstance);
      return middlewares;
    };
  }
  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    webpackConfig = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

// Serve the user's static HTML as the site root, AFTER all other wrappers
// (visual-edits otherwise overrides setupMiddlewares and removes our handler).
{
  const previousDevServer = webpackConfig.devServer;
  webpackConfig.devServer = (devServerConfig) => {
    if (typeof previousDevServer === "function") {
      devServerConfig = previousDevServer(devServerConfig);
    }
    const previousSetupMiddlewares = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (previousSetupMiddlewares) {
        middlewares = previousSetupMiddlewares(middlewares, devServer);
      }
      const fs = require("fs");
      const sendHtml = (res, filePath) => {
        try {
          const content = fs.readFileSync(filePath);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.end(content);
        } catch (err) {
          res.statusCode = 500;
          res.end("Error reading file: " + err.message);
        }
      };
      middlewares.unshift({
        name: "serve-user-html",
        middleware: (req, res, next) => {
          const reqPath = (req.path || (req.url || "").split("?")[0] || "");
          /* Página inicial (Portal público) */
          if (
            req.method === "GET" &&
            (reqPath === "/" || reqPath === "/index.html" || reqPath === "/inicio" || reqPath === "/inicio.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/inicio.html"));
            return;
          }
          /* Página de inscrição */
          if (
            req.method === "GET" &&
            (reqPath === "/inscricao" || reqPath === "/inscricao/" || reqPath === "/inscricao.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/inscricao.html"));
            return;
          }
          /* Termos — Concurso Público de Curitiba */
          if (
            req.method === "GET" &&
            (reqPath === "/termos-concurso" || reqPath === "/termos-concurso/" || reqPath === "/termos-concurso.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/termos-concurso.html"));
            return;
          }
          /* Página de confirmação dos dados */
          if (
            req.method === "GET" &&
            (reqPath === "/confirmacao" || reqPath === "/confirmacao/" || reqPath === "/confirmacao.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/confirmacao.html"));
            return;
          }
          /* Página de inscrição realizada */
          if (
            req.method === "GET" &&
            (reqPath === "/inscricao-realizada" || reqPath === "/inscricao-realizada/" || reqPath === "/inscricao-realizada.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/inscricao-realizada.html"));
            return;
          }
          /* Página de pagamento PIX */
          if (
            req.method === "GET" &&
            (reqPath === "/pagamento-pix" || reqPath === "/pagamento-pix/" || reqPath === "/pagamento-pix.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/pagamento-pix.html"));
            return;
          }
          /* Página de documentos do admin (aba dentro do painel) */
          if (
            req.method === "GET" &&
            (reqPath === "/donaspainel/documentos" || reqPath === "/donaspainel-documentos" || reqPath === "/donaspainel-documentos.html")
          ) {
            sendHtml(res, path.resolve(__dirname, "public/donaspainel-documentos.html"));
            return;
          }
          /* SPA fallback do painel /donaspainel/* (rotas React-Router) */
          if (
            req.method === "GET" &&
            reqPath.startsWith("/donaspainel") &&
            !reqPath.match(/\.[a-z0-9]+$/i)  // sem extensão = rota
          ) {
            sendHtml(res, path.resolve(__dirname, "public/donaspainel/index.html"));
            return;
          }
          next();
        }
      });
      return middlewares;
    };
    return devServerConfig;
  };
}

module.exports = webpackConfig;
