#!/usr/bin/env python3
import pandas as pd
import glob
import os

# Check what months we have in Latcom data
topup_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/TOPUP  2023/*.xlsx") + \
              glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/TOPUP  2024/*.xlsx")

bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")

print("TOPUP FILES:")
for f in sorted(topup_files):
    print(f"  {os.path.basename(f)}")

print("\n\nBUNDLES FILES:")
for f in sorted(bundles_files):
    print(f"  {os.path.basename(f)}")

# Check Telefónica date range
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
tf['FECHA'] = pd.to_datetime(tf['FECHA'], format='%d/%m/%Y')
tf['YEAR_MONTH'] = tf['FECHA'].dt.to_period('M')

print("\n\nTELEFÓNICA TRANSACTIONS BY MONTH:")
print(tf['YEAR_MONTH'].value_counts().sort_index())

print("\n\nLATCOM FILES WE'RE MISSING:")
tf_months = set(tf['YEAR_MONTH'].astype(str))
print(f"Telefónica months: {sorted(tf_months)}")

# Extract months from filenames (rough extraction)
import re

def extract_month_from_filename(filename):
    filename = filename.upper()
    months = {
        'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
        'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
        'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
    }

    for month_name, month_num in months.items():
        if month_name in filename:
            # Extract year
            year_match = re.search(r'20\d{2}', filename)
            if year_match:
                year = year_match.group()
                return f"{year}-{month_num}"
    return None

topup_months = set()
for f in topup_files:
    month = extract_month_from_filename(os.path.basename(f))
    if month:
        topup_months.add(month)

bundles_months = set()
for f in bundles_files:
    month = extract_month_from_filename(os.path.basename(f))
    if month:
        bundles_months.add(month)

print(f"\nTOPUP months we have: {sorted(topup_months)}")
print(f"BUNDLES months we have: {sorted(bundles_months)}")

# Find missing months
tf_months_normalized = set([str(m).replace('2023-', '2023-').replace('2024-', '2024-') for m in tf_months])

missing_topup = tf_months_normalized - topup_months
missing_bundles = tf_months_normalized - bundles_months

print(f"\n\nMISSING TOPUP MONTHS: {sorted(missing_topup)}")
print(f"MISSING BUNDLES MONTHS: {sorted(missing_bundles)}")
