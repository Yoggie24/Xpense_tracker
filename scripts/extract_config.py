import pandas as pd
import json

def extract_config(file_path):
    config = {"categories": [], "paymentMethods": []}
    
    try:
        # Load the 'List' sheet for categories and methods
        list_df = pd.read_excel(file_path, sheet_name='List')
        
        # Load 'Rasio' sheet for starting balances
        rasio_df = pd.read_excel(file_path, sheet_name='Rasio')
        # Use first row as headers if they are not correctly identified
        if 'Item' not in rasio_df.columns:
            rasio_df = pd.read_excel(file_path, sheet_name='Rasio', header=0)

        # Process Payment Methods from 'Metode' column and Rasio balances
        if 'Metode' in list_df.columns:
            methods = list_df['Metode'].dropna().unique()
            for m in methods:
                # Find starting balance in Rasio sheet
                starting = 0
                if 'Item' in rasio_df.columns and 'IDR' in rasio_df.columns:
                    match = rasio_df[rasio_df['Item'] == m]
                    if not match.empty:
                        starting = float(match.iloc[0]['IDR'])
                
                config["paymentMethods"].append({
                    "name": m,
                    "icon": "🏦" if m not in ["Cash", "Gopay", "Shopeepay"] else ("💵" if m == "Cash" else "📱"),
                    "starting": starting
                })

        # Process Outcome Categories
        if 'Outcome List' in list_df.columns:
            outcomes = list_df['Outcome List'].dropna().unique()
            for o in outcomes:
                config["categories"].append({
                    "name": o,
                    "icon": "🛍️",
                    "starting": 0,
                    "type": "Outcome"
                })

        # Process Income Categories
        if 'Income List' in list_df.columns:
            incomes = list_df['Income List'].dropna().unique()
            for i in incomes:
                config["categories"].append({
                    "name": i,
                    "icon": "💰",
                    "starting": 0,
                    "type": "Income"
                })

        print(json.dumps(config, indent=4))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_config(r"b:\Workspace\Keuangan\simple-money-tracker\Keuangan.xlsx")
