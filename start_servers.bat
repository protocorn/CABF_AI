@echo off
echo Starting both servers...

:: Start Flask server in a new window
start cmd /k "echo Starting Flask server... && python pinecone_service.py"

:: Wait a bit for Flask to initialize
timeout /t 5

:: Start Node.js server in a new window
start cmd /k "echo Starting Node.js server... && npm start"

echo Both servers should be starting now. Check the command windows for any errors. 