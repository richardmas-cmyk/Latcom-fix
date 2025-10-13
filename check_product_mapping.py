#!/usr/bin/env python3
import pandas as pd

# Load files
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
bundles = pd.read_excel("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/BUNDLES SEPTIEMBRE 2023.xlsx")

print("TELEFONICA PRODUCT CODES:")
print(tf['COD_BONO'].value_counts())

print("\n\nLATCOM BUNDLES PRODUCT CODES:")
print(bundles['Product'].value_counts())

# Check if product names contain telefonica codes
print("\n\nPRODUCT MAPPING ANALYSIS:")
print("="*80)

# Extract the middle part of Latcom product names
for latcom_product in bundles['Product'].unique():
    for tf_code in tf['COD_BONO'].unique():
        if tf_code in latcom_product:
            print(f"{tf_code} -> {latcom_product}")

# Check a specific match example
print("\n\nSAMPLE MATCHING ATTEMPT:")
print("="*80)

# Parse dates
tf['FECHA'] = pd.to_datetime(tf['FECHA'], format='%d/%m/%Y')
bundles['DATE_PARSED'] = pd.to_datetime(bundles['TransactionDate'])

# Filter to September 2023
tf_sept = tf[tf['FECHA'].dt.to_period('M') == '2023-09']
bundles_sept = bundles[bundles['DATE_PARSED'].dt.to_period('M') == '2023-09']

print(f"Telefonica Sept 2023: {len(tf_sept):,} transactions")
print(f"Latcom Bundles Sept 2023: {len(bundles_sept):,} transactions")

# Try to match one specific phone number
sample_phone = tf_sept['NUM_TELEFONO'].iloc[0]
print(f"\nSample phone from Telefonica: {sample_phone}")

tf_sample = tf_sept[tf_sept['NUM_TELEFONO'] == sample_phone]
bundles_sample = bundles_sept[bundles_sept['TargetMSISDN'] == sample_phone]

print(f"\nTelefonica transactions for {sample_phone}:")
print(tf_sample[['FECHA', 'NUM_TELEFONO', 'COD_BONO', 'ImpUSD', 'SEC_ACTUACION']])

print(f"\nLatcom BUNDLES transactions for {sample_phone}:")
print(bundles_sample[['TransactionDate', 'TargetMSISDN', 'Product', 'TransactionAmountUSD']])

# Try a common phone
common_phones = set(tf_sept['NUM_TELEFONO'].astype(str)).intersection(set(bundles_sept['TargetMSISDN'].astype(str)))
if common_phones:
    sample_common = int(list(common_phones)[0])
    print(f"\n\nCOMMON PHONE EXAMPLE: {sample_common}")
    print("="*80)

    tf_common = tf_sept[tf_sept['NUM_TELEFONO'] == sample_common]
    bundles_common = bundles_sept[bundles_sept['TargetMSISDN'] == sample_common]

    print(f"\nTelefonica transactions:")
    print(tf_common[['FECHA', 'NUM_TELEFONO', 'COD_BONO', 'ImpUSD', 'SEC_ACTUACION']])

    print(f"\nLatcom BUNDLES transactions:")
    print(bundles_common[['TransactionDate', 'TargetMSISDN', 'Product', 'TransactionAmountUSD', 'TransactionID']])
