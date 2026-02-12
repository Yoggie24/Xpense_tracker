import gspread
import json
import os
from google.oauth2.service_account import Credentials

def get_gspread_client():
    creds_json = os.environ.get('GOOGLE_CREDS')
    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    
    if creds_json:
        creds_dict = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    else:
        creds = Credentials.from_service_account_file('service_account.json', scopes=scopes)
    return gspread.authorize(creds)

def inspect_gsheet(sheet_name_or_id):
    client = get_gspread_client()
    
    try:
        sh = client.open(sheet_name_or_id) if not sheet_name_or_id.startswith('1') else client.open_by_key(sheet_name_or_id)
        
        print(f"File Title: {sh.title}")
        print("Worksheets:")
        for ws in sh.worksheets():
            print(f"- {ws.title}")
            # Show first 5 rows and headers
            try:
                data = ws.get_all_values()
                if data:
                    print(f"  Headers: {data[0]}")
                    print(f"  Sample Row: {data[1] if len(data) > 1 else 'N/A'}")
            except Exception as e:
                print(f"  Could not read data: {e}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    target = os.environ.get('GSHEET_TARGET', 'Keuangan')
    inspect_gsheet(target)
