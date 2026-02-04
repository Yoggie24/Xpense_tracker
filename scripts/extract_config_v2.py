import pandas as pd
import json

def get_config():
    path = r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx"
    df_list = pd.read_excel(path, sheet_name='List')
    df_rasio = pd.read_excel(path, sheet_name='Rasio', header=None) # Read without header to be safe
    
    # Find the row where 'Item' and 'IDR' are
    header_row = 0
    for i, row in df_rasio.iterrows():
        if 'Item' in row.values and 'IDR' in row.values:
            header_row = i
            break
    
    # Set headers
    df_rasio.columns = df_rasio.iloc[header_row]
    df_rasio = df_rasio.drop(df_rasio.index[:header_row+1])
    
    config = {"categories": [], "paymentMethods": []}
    
    # Payment Methods
    if 'Metode' in df_list.columns:
        methods = df_list['Metode'].dropna().unique()
        for m in methods:
            starting = 0
            if 'Item' in df_rasio.columns and 'IDR' in df_rasio.columns:
                match = df_rasio[df_rasio['Item'] == m]
                if not match.empty:
                    val = match.iloc[0]['IDR']
                    try:
                        starting = float(val) if not pd.isna(val) else 0
                    except:
                        starting = 0
            
            config["paymentMethods"].append({
                "name": m,
                "icon": "📱" if "pay" in m.lower() else ("🏦" if m != "Cash" else "💵"),
                "starting": starting
            })
            
    # Outcome Categories
    if 'Outcome List' in df_list.columns:
        for o in df_list['Outcome List'].dropna().unique():
            config["categories"].append({"name": o, "icon": "🛍️", "starting": 0, "type": "Outcome"})
            
    # Income Categories
    if 'Income List' in df_list.columns:
        for i in df_list['Income List'].dropna().unique():
            config["categories"].append({"name": i, "icon": "💰", "starting": 0, "type": "Income"})
            
    print(json.dumps(config, indent=4))

get_config()
