import gspread
import json
import os
from google.oauth2.service_account import Credentials

def get_gspread_client():
    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    
    # Priority 1: GitHub Secrets / Environment
    creds_json = os.environ.get('GOOGLE_CREDS') or os.environ.get('GSPREAD_SERVICE_ACCOUNT')
    
    # Priority 2: config.json
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
            if not creds_json:
                creds_json = config.get('google_creds')

    if creds_json:
        creds_dict = json.loads(creds_json) if isinstance(creds_json, str) else creds_json
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    else:
        # Fallback to local file
        creds_path = os.path.join(os.path.dirname(__file__), 'service_account.json')
        if os.path.exists(creds_path):
            creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        else:
            raise FileNotFoundError("Google credentials not found (env, config.json, or service_account.json)")
            
    return gspread.authorize(creds)

def get_target_sheet():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f).get('gsheet_target', 'Keuangan')
    return os.environ.get('GSHEET_TARGET', 'Keuangan')

def extract_config(sheet_name_or_id):
    client = get_gspread_client()
    
    try:
        sh = client.open(sheet_name_or_id) if not sheet_name_or_id.startswith('1') else client.open_by_key(sheet_name_or_id)
        
        config = {"categories": [], "paymentMethods": []}
        
        # 1. Process 'List' worksheet - Use get_all_values for pure data
        try:
            list_ws = sh.worksheet('List')
            list_data = list_ws.get_all_values()
            
            if list_data:
                headers = [h.lower().strip() for h in list_data[0]]
                metodo_idx = headers.index('metode') if 'metode' in headers else -1
                outcome_idx = headers.index('outcome list') if 'outcome list' in headers else -1
                income_idx = headers.index('income list') if 'income list' in headers else -1
                
                for row in list_data[1:]:
                    metodo = row[metodo_idx].strip() if metodo_idx != -1 and len(row) > metodo_idx else None
                    outcome = row[outcome_idx].strip() if outcome_idx != -1 and len(row) > outcome_idx else None
                    income = row[income_idx].strip() if income_idx != -1 and len(row) > income_idx else None
                    
                    if metodo:
                        config["paymentMethods"].append({
                            "name": metodo,
                            "icon": "🏦",
                            "starting": 0
                        })
                    if outcome:
                        config["categories"].append({
                            "name": outcome,
                            "icon": "🛍️",
                            "starting": 0,
                            "type": "Outcome"
                        })
                    if income:
                        config["categories"].append({
                            "name": income,
                            "icon": "💰",
                            "starting": 0,
                            "type": "Income"
                        })
        except gspread.exceptions.WorksheetNotFound:
            print("Warning: 'List' worksheet not found.")

        # 2. Process 'Rasio' for starting balances
        try:
            rasio_ws = sh.worksheet('Rasio')
            rasio_rows = rasio_ws.get_all_values()
            
            header_idx = -1
            for idx, row in enumerate(rasio_rows[:10]):
                row_lower = [v.lower().strip() for v in row]
                if 'item' in row_lower and 'idr' in row_lower:
                    header_idx = idx
                    break
            
            if header_idx != -1:
                headers = [h.lower().strip() for h in rasio_rows[header_idx]]
                item_col = headers.index('item')
                idr_col = headers.index('idr')
                
                for row in rasio_rows[header_idx+1:]:
                    if not row or len(row) <= max(item_col, idr_col): continue
                    item_name = row[item_col].strip()
                    if not item_name or item_name == 'Grand Total': continue
                    
                    try:
                        val_str = row[idr_col].replace('Rp', '').replace('.', '').replace(',', '').strip()
                        val = float(val_str) if val_str else 0
                    except:
                        val = 0
                        
                    for m in config["paymentMethods"]:
                        if m["name"].lower().strip() == item_name.lower().strip():
                            m["starting"] = val
                            break
        except gspread.exceptions.WorksheetNotFound:
            print("Warning: 'Rasio' worksheet not found.")

        # Final Cleaning & Unique Lists
        config["paymentMethods"] = [dict(t) for t in {tuple(d.items()) for d in config["paymentMethods"] if d["name"]}]
        config["categories"] = [dict(t) for t in {tuple(d.items()) for d in config["categories"] if d["name"]}]

        print(json.dumps(config, indent=4))
        # Support both names for backward/forward compatibility
        for filename in ['data/config_output.json', 'data/config-gsheet.json']:
            with open(filename, 'w') as f:
                json.dump(config, f, indent=4)
        
    except Exception as e:
        print(f"Error extracting config: {e}")

if __name__ == "__main__":
    target = get_target_sheet()
    extract_config(target)
