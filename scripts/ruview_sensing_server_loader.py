"""
Helper loader to import modules from ruview-sensing-server.py (which has hyphens in filename).
"""
import importlib.util
import sys
from pathlib import Path

def get_server_module():
    server_path = Path(__file__).resolve().parent / "ruview-sensing-server.py"
    spec = importlib.util.spec_from_file_location("ruview_sensing_server", str(server_path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ruview_sensing_server"] = mod
    spec.loader.exec_module(mod)
    return mod

def get_server_modules():
    mod = get_server_module()
    return mod.WiFiCsiDspEngine(), mod.InvisiGuardMLEngine()
