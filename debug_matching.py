#!/usr/bin/env python3
import pandas as pd
from datetime import timedelta

# Load data
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
bundles = pd.read_excel("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/BUNDLES SEPTIEMBRE 2023.xlsx")

# Parse dates
tf['FECHA'] = pd.to_datetime(tf['FECHA'], format='%d/%m/%Y')
bundles['DATE_PARSED'] = pd.to_datetime(bundles['TransactionDate'])

# Product mapping
PRODUCT_MAPPING = {
    'BFRECINT': 'TEMXN_BFRECINT_30_DAYS',
    'BFSPRINT': 'TEMXN_BFSPRINT_UNLIMITED_30_DAYS',
    'BFRIQUIN': 'TEMXN_BFRIQUIN_28_DAYS',
    'BFRISEM': 'TEMXN_BFRISEM_7_DAYS',
    'BFRIMEN': 'TEMXN_BFRIMEN_15_DAYS',
}

tf['PRODUCT_LATCOM'] = tf['COD_BONO'].map(PRODUCT_MAPPING).fillna('')
tf['PHONE'] = tf['NUM_TELEFONO'].astype(str).str.strip()
bundles['PHONE'] = bundles['TargetMSISDN'].astype(str).str.strip()
bundles['PRODUCT'] = bundles['Product'].astype(str).str.strip()

# Filter to September 2023
tf_sept = tf[tf['FECHA'].dt.to_period('M') == '2023-09']
bundles_sept = bundles[bundles['DATE_PARSED'].dt.to_period('M') == '2023-09']

print(f"Telefónica Sept 2023: {len(tf_sept):,}")
print(f"Bundles Sept 2023: {len(bundles_sept):,}")

# Try a specific example
sample = tf_sept.iloc[0]
print(f"\nSample TF transaction:")
print(f"  Phone: {sample['PHONE']}")
print(f"  Date: {sample['FECHA']}")
print(f"  Product TF: {sample['COD_BONO']}")
print(f"  Product Latcom: {sample['PRODUCT_LATCOM']}")

# Find matches in bundles
phone = sample['PHONE']
date = sample['FECHA']
product = sample['PRODUCT_LATCOM']

date_min = date - timedelta(days=7)
date_max = date + timedelta(days=7)

print(f"\nSearching in Bundles for:")
print(f"  Phone: {phone}")
print(f"  Product: {product}")
print(f"  Date range: {date_min.strftime('%Y-%m-%d')} to {date_max.strftime('%Y-%m-%d')}")

matching = bundles_sept[
    (bundles_sept['PHONE'] == phone) &
    (bundles_sept['PRODUCT'] == product) &
    (bundles_sept['DATE_PARSED'] >= date_min) &
    (bundles_sept['DATE_PARSED'] <= date_max)
]

print(f"\nMatches found: {len(matching)}")
if not matching.empty:
    print(matching[['TransactionDate', 'TargetMSISDN', 'Product', 'TransactionAmountUSD']])

# Check phone overlap
print(f"\n\nPhone overlap check:")
tf_phones = set(tf_sept['PHONE'])
bundles_phones = set(bundles_sept['PHONE'])
overlap = tf_phones.intersection(bundles_phones)
print(f"TF unique phones: {len(tf_phones):,}")
print(f"Bundles unique phones: {len(bundles_phones):,}")
print(f"Overlap: {len(overlap):,}")

# Try to match on a phone that's in both
if overlap:
    test_phone = list(overlap)[0]
    print(f"\n\nTesting phone {test_phone}:")

    tf_test = tf_sept[tf_sept['PHONE'] == test_phone]
    bundles_test = bundles_sept[bundles_sept['PHONE'] == test_phone]

    print(f"\nTelefónica transactions for {test_phone}:")
    print(tf_test[['FECHA', 'COD_BONO', 'PRODUCT_LATCOM', 'ImpUSD']])

    print(f"\nBundles transactions for {test_phone}:")
    print(bundles_test[['TransactionDate', 'Product', 'TransactionAmountUSD']])

    # Try to match first TF transaction
    tf_row = tf_test.iloc[0]
    product_to_match = tf_row['PRODUCT_LATCOM']
    date_to_match = tf_row['FECHA']

    print(f"\n\nTrying to match:")
    print(f"  Product: {product_to_match}")
    print(f"  Date: {date_to_match}")

    date_min = date_to_match - timedelta(days=7)
    date_max = date_to_match + timedelta(days=7)

    matching = bundles_test[
        (bundles_test['PRODUCT'] == product_to_match) &
        (bundles_test['DATE_PARSED'] >= date_min) &
        (bundles_test['DATE_PARSED'] <= date_max)
    ]

    print(f"Matches found: {len(matching)}")
    if not matching.empty:
        print(matching)
