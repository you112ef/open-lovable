// Cloudflare Pages Function for Sandbox Management
// This replaces app/api/sandbox/route.ts

import { Sandbox } from 'e2b';

interface Env {
  E2B_API_KEY: string;
}

// Global sandbox storage (in production, use a database)
let globalSandboxes = new Map<string, any>();

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    const { action, sandboxId, ...params } = await request.json();

    switch (action) {
      case 'create':
        return await createSandbox(env);
      case 'status':
        return await getSandboxStatus(sandboxId);
      case 'kill':
        return await killSandbox(sandboxId);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Sandbox API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Sandbox operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function createSandbox(env: Env) {
  try {
    const sandbox = await Sandbox.create({
      apiKey: env.E2B_API_KEY,
      template: 'base',
    });

    // Store sandbox reference
    globalSandboxes.set(sandbox.id, {
      id: sandbox.id,
      url: `https://${sandbox.id}.e2b.dev`,
      created: new Date().toISOString(),
      status: 'active'
    });

    // Initialize the sandbox with basic setup
    await sandbox.filesystem.write('/package.json', JSON.stringify({
      name: 'open-lovable-sandbox',
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        start: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        vite: '^5.0.0',
        '@vitejs/plugin-react': '^4.0.0'
      }
    }, null, 2));

    await sandbox.filesystem.write('/index.html', `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Open Lovable App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`);

    await sandbox.filesystem.write('/vite.config.js', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})`);

    await sandbox.filesystem.write('/src/main.jsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`);

    await sandbox.filesystem.write('/src/App.jsx', `import React from 'react'

function App() {
  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀 Open Lovable</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
        مرحباً بك في بيئة التطوير الذكية
      </p>
      <div style={{ 
        background: 'rgba(255,255,255,0.1)', 
        padding: '2rem', 
        borderRadius: '1rem',
        backdropFilter: 'blur(10px)'
      }}>
        <p>✅ Sandbox جاهز للاستخدام</p>
        <p>✅ React & Vite مثبتان</p>
        <p>✅ يمكن البدء في التطوير الآن</p>
      </div>
    </div>
  )
}

export default App`);

    // Install packages
    await sandbox.process.start({
      cmd: 'npm install',
      onStdout: (data) => console.log('npm install:', data),
      onStderr: (data) => console.error('npm install error:', data),
    });

    // Start dev server
    const devServer = await sandbox.process.start({
      cmd: 'npm run dev',
      onStdout: (data) => console.log('dev server:', data),
      onStderr: (data) => console.error('dev server error:', data),
    });

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId: sandbox.id,
        url: `https://${sandbox.id}.e2b.dev`,
        message: 'Sandbox created successfully',
        structure: 'React + Vite project initialized'
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Create sandbox error:', error);
    throw error;
  }
}

async function getSandboxStatus(sandboxId: string) {
  const sandboxData = globalSandboxes.get(sandboxId);
  
  if (!sandboxData) {
    return new Response(
      JSON.stringify({ active: false, healthy: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      active: true,
      healthy: true,
      sandboxData
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function killSandbox(sandboxId: string) {
  try {
    // Remove from global storage
    globalSandboxes.delete(sandboxId);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Sandbox terminated' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Kill sandbox error:', error);
    throw error;
  }
}

// Handle GET requests for status checks
export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const sandboxId = url.searchParams.get('sandboxId');
  
  if (sandboxId) {
    return await getSandboxStatus(sandboxId);
  }
  
  return new Response(
    JSON.stringify({ 
      message: 'Sandbox API is running',
      activeSandboxes: globalSandboxes.size
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Handle CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}