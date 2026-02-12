import gspread
import json
import os
from google.oauth2.service_account import Credentials

def get_gspread_client():
    # Attempt to load credentials from environment variable (GitHub Secrets)
    # or from local service_account.json
    creds_json = os.environ.get('GOOGLE_CREDS')
    
    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    
    if creds_json:
        creds_dict = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    else:
        # Fallback to local file
        creds = Credentials.from_service_account_file('service_account.json', scopes=scopes)
        
    return gspread.authorize(creds)

def extract_config(sheet_name_or_id):
    client = get_gspread_client()
    
    try:
        # Open by name or ID
        sh = client.open(sheet_name_or_id) if not sheet_name_or_id.startswith('1') else client.open_by_key(sheet_name_or_id)
        
        config = {"categories": [], "paymentMethods": []}
        
        # 1. Process 'List' worksheet
        try:
            list_ws = sh.worksheet('List')
            list_data = list_ws.get_all_records()
            
            for row in list_data:
                # Use case-insensitive key lookup
                def get_val(r, k):
                    found = [val for key, val in r.items() if key.lower().strip() == k.lower()]
                    return found[0] if found else None

                metodo = get_val(row, 'Metode')
                outcome = get_val(row, 'Outcome List')
                income = get_val(row, 'Income List')
                
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
            
            # Find headers
            header_row = []
            header_idx = -1
            for idx, row in enumerate(rasio_rows[:10]):
                row_lower = [v.lower() for v in row]
                if 'item' in row_lower and 'idr' in row_lower:
                    header_row = row_lower
                    header_idx = idx
                    break
            
            if header_idx != -1:
                item_col = header_row.index('item')
                idr_col = header_row.index('idr')
                
                for row in rasio_rows[header_idx+1:]:
                    if not row or len(row) <= max(item_col, idr_col): continue
                    item_name = row[item_col]
                    if not item_name or item_name == 'Grand Total': continue
                    
                    try:
                        # Clean currency formatting
                        val_str = row[idr_col].replace('Rp', '').replace('.', '').replace(',', '').strip()
                        val = float(val_str) if val_str else 0
                    except:
                        val = 0
                        
                    # Find and update matching method
                    for m in config["paymentMethods"]:
                        if m["name"].lower().strip() == item_name.lower().strip():
                            m["starting"] = val
                            break
        except gspread.exceptions.WorksheetNotFound:
            print("Warning: 'Rasio' worksheet not found.")

        print(json.dumps(config, indent=4))
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # The user should set SHEET_NAME_OR_ID as an environment variable or edit here
    target = os.environ.get('GSHEET_TARGET', 'Keuangan')
    extract_config(target)
