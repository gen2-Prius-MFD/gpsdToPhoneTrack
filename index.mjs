import http from 'http';
import { spawn } from 'child_process';
import {readFile, writeFile} from 'fs/promises';

// config file stuff
let config = await loadConfig()
async function loadConfig(){
  const data = await readFile('./config.json', 'utf-8');
  return JSON.parse(data);
}
async function saveConfig(c){
  config=c
  writeFile('./config.json', JSON.stringify(c), 'utf-8')
}

const html = await readFile('index.html');

// http server stuff
const PORT = 3078;
const server = http.createServer((req, res) => {
  switch (req.url){
    case "/":{
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html)
    }break;
    case "/load":{
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(config))
    }break;
    case "/save":{
      if (req.method !== 'POST') return;

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        saveConfig(JSON.parse(body))
        res.writeHead(200);
        res.end();
        stopProgram();
        startProgram(); 
      })
    }break;
    default: {
      res.writeHead(404)
      res.end()
    }
  }
});
server.listen(PORT, 'localhost', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  startProgram()
});


const programPath = './gpsTracker.mjs';
let programProcess = null;
function startProgram() {
  console.log('Starting program...');
  const prams = Object.entries(config).flatMap(([key, value]) => [`--${key}`, value]);
  programProcess = spawn('node', [programPath, ...prams], { stdio: 'inherit' });

  programProcess.on('error', (err) => {
    console.error('Error starting the program:', err);
  });

  programProcess.on('exit', (code, signal) => {
    console.log(code ? `Program exited with code ${code}` : `Program was killed with signal ${signal}`);
  });
}

function stopProgram() {
  if (programProcess) {
    console.log('Stopping program...');
    programProcess.kill();
    programProcess = null;
  }
}