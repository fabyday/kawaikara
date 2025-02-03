const os = require('os');
const exec = require('child_process').exec;

if (os.platform() === 'darwin' || os.platform() === 'linux') {
  // terminate the process using port 3000 on macOS/Linux, 
  exec('kill $(lsof -t -i:3000)', (err, stdout, stderr) => {
      if (err) {
          console.error(`Error: ${stderr}`);
          return;
        }
        console.log(`Server stopped: ${stdout}`);
    });
} else if (os.platform() === 'win32') {
    // terminate the process using port 3000 on Window, 
    exec('powershell -Command "Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', (err, stdout, stderr) => {
      if (err) {
        console.error(`Error: ${stderr}`);
        return;
      }
      console.log(`Server stopped: ${stdout}`);
    });
}


