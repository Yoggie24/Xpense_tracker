import gspread
from google.oauth2.service_account import Credentials
import json
import os
from datetime import datetime

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
            raise FileNotFoundError("Google credentials not found in environment or service_account.json")
            
    return gspread.authorize(creds)

def get_target_sheet():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f).get('gsheet_target', 'Keuangan')
    return os.environ.get('GSHEET_TARGET', 'Keuangan')

def find_last_data_row(ws):
    """Finds the last row that has a value in the first column (Date)."""
    all_values = ws.col_values(1) # Get first column
    # Return index of last non-empty value
    for i, val in enumerate(reversed(all_values)):
        if val.strip():
            return len(all_values) - i
    return 1 # Default to header if empty

def sync_transactions(sheet_id, local_json_path):
    client = get_gspread_client()
    sh = client.open_by_key(sheet_id)
    ws = sh.worksheet('Money_tracker')
    
    # Load local transactions
    if not os.path.exists(local_json_path):
        print(f"Local transaction file not found: {local_json_path}")
        return
        
    with open(local_json_path, 'r') as f:
        local_data = json.load(f)
        local_txs = local_data.get('transactions', local_data) if isinstance(local_data, dict) else local_data

    # Read GSheet data to avoid duplicates
    gsheet_rows = ws.get_all_values()
    gsheet_keys = set()
    
    # Identify headers and last row with data
    last_row = 1
    if gsheet_rows:
        headers = [h.lower().strip() for h in gsheet_rows[0]]
        idx_map = {
            'date': headers.index('date') if 'date' in headers else 0,
            'account': headers.index('account') if 'account' in headers else 1,
            'category': headers.index('category') if 'category' in headers else 2,
            'desc': headers.index('description') if 'description' in headers else 3,
            'amount': headers.index('idr') if 'idr' in headers else 5,
        }
        
        # Build uniqueness keys and find actual last row
        for i, row in enumerate(gsheet_rows[1:]):
            if len(row) > max(idx_map.values()) and row[idx_map['date']].strip():
                key = (
                    row[idx_map['date']].strip(), 
                    row[idx_map['account']].strip(), 
                    row[idx_map['category']].strip(), 
                    row[idx_map['desc']].strip(), 
                    row[idx_map['amount']].replace('Rp', '').replace('.', '').replace(',', '').strip()
                )
                gsheet_keys.add(key)
                last_row = i + 2 # Header is row 1, first data is row 2

    # Identify missing transactions
    new_rows = []
    for tx in local_txs:
        date_str = tx.get('date', '').split('T')[0]
        amount_val = tx.get('amount', 0)
        
        key = (
            date_str,
            tx.get('paymentMethod', '').strip(),
            tx.get('category', '').strip(),
            tx.get('description', '').strip(),
            str(int(amount_val))
        )
        
        if key not in gsheet_keys:
            row = [
                date_str,
                tx.get('paymentMethod', '').strip(),
                tx.get('category', '').strip(),
                tx.get('description', '').strip(),
                '', # Item
                amount_val,
                'Income' if tx.get('type') == 'income' else 'Outcome'
            ]
            new_rows.append(row)

    if new_rows:
        target_row = last_row + 1
        print(f"Smart Append: Pushing {len(new_rows)} new transactions starting at row {target_row}...")
        # update range directly to avoid "ghost rows" issues with append_rows
        # ws.update(f'A{target_row}', new_rows, value_input_option='USER_ENTERED')
        # Actually append_rows with table range usually works better for formatting inheritance
        # if the table is defined. But the user specifically asked for smart append.
        ws.update(f'A{target_row}', new_rows, value_input_option='USER_ENTERED')
        print("Sync complete.")
    else:
        print("No new transactions to sync.")

if __name__ == "__main__":
    SHEET_ID = get_target_sheet()
    # Use the backup file generated by the web app's Drive sync/download
    LOCAL_DATA = 'data/money-tracker-backup.json'
    if not os.path.exists(LOCAL_DATA):
        # Fallback to a general transactions.json if available
        LOCAL_DATA = 'data/transactions.json'
    sync_transactions(SHEET_ID, LOCAL_DATA)
