#!/usr/bin/env python3
import pandas as pd
import glob
from datetime import timedelta

# Load Telefónica
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
tf['FECHA'] = pd.to_datetime(tf['FECHA'], format='%d/%m/%Y')
tf['PHONE'] = tf['NUM_TELEFONO'].astype(str).str.strip()

# Load ALL Bundles files
bundles_files = glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") + \
                glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")

all_bundles = []
for f in bundles_files:
    df = pd.read_excel(f)
    all_bundles.append(df)

bundles = pd.concat(all_bundles, ignore_index=True)
bundles['DATE_PARSED'] = pd.to_datetime(bundles['TransactionDate'], errors='coerce')
bundles['PHONE'] = bundles['TargetMSISDN'].astype(str).str.strip()
bundles['PRODUCT'] = bundles['Product'].astype(str).str.strip()

# Product mapping
PRODUCT_MAPPING = {
    'BFRECINT': 'TEMXN_BFRECINT_30_DAYS',
    'BFSPRINT': 'TEMXN_BFSPRINT_UNLIMITED_30_DAYS',
    'BFRIQUIN': 'TEMXN_BFRIQUIN_28_DAYS',
    'BFRISEM': 'TEMXN_BFRISEM_7_DAYS',
    'BFRIMEN': 'TEMXN_BFRIMEN_15_DAYS',
}

tf['PRODUCT_LATCOM'] = tf['COD_BONO'].map(PRODUCT_MAPPING).fillna('')

# Filter bundles to only mapped products
bundles_filtered = bundles[bundles['PRODUCT'].isin(PRODUCT_MAPPING.values())].copy()

print(f"Total TF: {len(tf):,}")
print(f"Total Bundles (all): {len(bundles):,}")
print(f"Total Bundles (mapped products): {len(bundles_filtered):,}")

# Check phone overlaps
tf_phones = set(tf['PHONE'])
bundles_phones = set(bundles_filtered['PHONE'])

print(f"\nTF unique phones: {len(tf_phones):,}")
print(f"Bundles unique phones: {len(bundles_phones):,}")

overlap = tf_phones.intersection(bundles_phones)
print(f"Phone overlap: {len(overlap):,}")

if not overlap:
    print("\nNO PHONE OVERLAP! Let's check if phone numbers are formatted differently...")

    # Check sample phones
    print(f"\nSample TF phones: {list(tf_phones)[:10]}")
    print(f"Sample Bundles phones: {list(bundles_phones)[:10]}")

    # Check data types
    print(f"\nTF phone type: {tf['NUM_TELEFONO'].dtype}")
    print(f"Bundles phone type: {bundles['TargetMSISDN'].dtype}")

    # Check if conversion is the issue
    print(f"\nTF raw phone sample: {tf['NUM_TELEFONO'].head(5).tolist()}")
    print(f"Bundles raw phone sample: {bundles['TargetMSISDN'].head(5).tolist()}")

else:
    # Try matching on one overlapping phone
    test_phone = list(overlap)[0]
    print(f"\n\nTesting phone {test_phone}:")

    tf_test = tf[tf['PHONE'] == test_phone]
    bundles_test = bundles_filtered[bundles_filtered['PHONE'] == test_phone]

    print(f"TF transactions: {len(tf_test)}")
    print(tf_test[['FECHA', 'COD_BONO', 'PRODUCT_LATCOM', 'ImpUSD']].head())

    print(f"\nBundles transactions: {len(bundles_test)}")
    print(bundles_test[['TransactionDate', 'Product', 'TransactionAmountUSD']].head())

    # Try to match first transaction
    if not tf_test.empty and not bundles_test.empty:
        tf_row = tf_test.iloc[0]
        date = tf_row['FECHA']
        product = tf_row['PRODUCT_LATCOM']

        date_min = date - timedelta(days=7)
        date_max = date + timedelta(days=7)

        matches = bundles_test[
            (bundles_test['PRODUCT'] == product) &
            (bundles_test['DATE_PARSED'] >= date_min) &
            (bundles_test['DATE_PARSED'] <= date_max)
        ]

        print(f"\nTrying to match:")
        print(f"  Date: {date}")
        print(f"  Product: {product}")
        print(f"  Matches found: {len(matches)}")

        if not matches.empty:
            print(matches[['TransactionDate', 'Product', 'TransactionAmountUSD']])
