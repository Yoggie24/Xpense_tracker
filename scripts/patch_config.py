import pandas as pd
import json
import numpy as np

def update_script_js():
    xlsx_path = r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx"
    script_path = r"b:\Workspace\Keuangan\simple-money-tracker\assets\js\script.js"
    
    # 1. Read Sheets
    try:
        df_list = pd.read_excel(xlsx_path, sheet_name='List')
        df_rasio = pd.read_excel(xlsx_path, sheet_name='Rasio', header=None)
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # 2. Parse Rasio for Methods and Currencies
    header_row_idx = -1
    for i, row in df_rasio.iterrows():
        if 'Item' in row.values and 'IDR' in row.values:
            header_row_idx = i
            break
    
    if header_row_idx == -1:
        print("Could not find Rasio headers")
        return

    rasio_headers = df_rasio.iloc[header_row_idx].tolist()
    df_rasio_data = df_rasio.drop(df_rasio.index[:header_row_idx+1])
    df_rasio_data.columns = rasio_headers
    
    config = {"categories": [], "paymentMethods": []}
    
    def get_val(v):
        try: return float(v) if pd.notna(v) else 0
        except: return 0

    # 3. Process Methods from List sheet, enriched by Rasio sheet
    if 'Metode' in df_list.columns:
        for m in df_list['Metode'].dropna().unique():
            method_name = str(m).strip()
            method_data = {"name": method_name}
            
            # Smart Icon Assignment
            low_m = method_name.lower()
            if any(x in low_m for x in ['bca', 'mandiri', 'bank', 'jenius', 'seabank']): method_data["icon"] = "🏦"
            elif any(x in low_m for x in ['pay', 'wallet', 'gopay', 'shopee']): method_data["icon"] = "📱"
            elif "cash" in low_m: method_data["icon"] = "💵"
            elif "gold" in low_m or "emas" in low_m: method_data["icon"] = "✨"
            elif "saham" in low_m or "stock" in low_m: method_data["icon"] = "📈"
            else: method_data["icon"] = "💰"

            # Detect Currency and Starting Balance from Rasio
            match = df_rasio_data[df_rasio_data['Item'].astype(str).str.strip() == method_name]
            if not match.empty:
                row = match.iloc[0]
                idr_val = get_val(row.get('IDR'))
                usd_val = get_val(row.get('USD'))
                kurs_val = get_val(row.get('Kurs'))
                
                # Concept: If USD column has value > 0, or name is Jenius/Vallas, it's a USD asset
                if usd_val > 0 or any(x in low_m for x in ['vallas', 'jenius']):
                    method_data["isUSD"] = True
                    method_data["starting"] = usd_val
                else:
                    method_data["starting"] = idr_val
                
                # Concept: Investment Assets (Gold, Saham, etc.)
                if any(x in low_m for x in ['gold', 'saham', 'investasi', 'emas', 'reksadana']):
                    method_data["isInvestment"] = True
                    if any(x in low_m for x in ['gold', 'saham', 'emas']):
                        # For Gold/Saham, 'Nilai' column in your Excel is index 3 or named 'Kurs' or 'Nilai'
                        # In the logs, Row 1 (header) index 3 is 'Kurs' and index 4 is 'Harga saat ini'
                        # Let's check if the match row has values there
                        method_data["qty"] = get_val(row.get('Kurs')) if 'Kurs' in row else 0
                        method_data["price"] = get_val(row.get('Harga saat ini')) if 'Harga saat ini' in row else 0
            else:
                method_data["starting"] = 0
            
            config["paymentMethods"].append(method_data)

    # 4. Process Categories (Outcome/Income List)
    # Ensure types are correctly capitalized for script.js
    if 'Outcome List' in df_list.columns:
        for o in df_list['Outcome List'].dropna().unique():
            config["categories"].append({
                "name": str(o).strip(),
                "icon": "🛍️",
                "starting": 0,
                "type": "Outcome"
            })
            
    if 'Income List' in df_list.columns:
        for i in df_list['Income List'].dropna().unique():
            config["categories"].append({
                "name": str(i).strip(),
                "icon": "💸",
                "starting": 0,
                "type": "Income"
            })
            
    # 5. Patch script.js
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    target_start = "const DEFAULT_CONFIG = {"
    start_idx = content.find(target_start)
    if start_idx != -1:
        end_idx = content.find("};", start_idx)
        if end_idx != -1:
            end_idx += 2 
            new_config_text = "const DEFAULT_CONFIG = " + json.dumps(config, indent=4) + ";"
            new_content = content[:start_idx] + new_config_text + content[end_idx:]
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
    
    print("Successfully patched script.js with Concept-Aware synchronization.")

if __name__ == "__main__":
    update_script_js()
