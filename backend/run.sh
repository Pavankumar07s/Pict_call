source venv/bin/activate
uvicorn main:app --reload --host 192.168.244.85 --port 3000 --ws websockets
