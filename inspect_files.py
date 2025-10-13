#!/usr/bin/env python3
import pandas as pd

# Inspect Telefonica file
print("TELEFONICA FILE:")
print("="*80)
tf = pd.read_csv("/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')
print(f"Columns: {list(tf.columns)}")
print(f"\nFirst 5 rows:")
print(tf.head())
print(f"\nSample transaction IDs (SEC_ACTUACION): {tf['SEC_ACTUACION'].head(10).tolist()}")

# Inspect a TOPUP file
print("\n\nTOPUP FILE (SEPTIEMBRE 2023):")
print("="*80)
topup = pd.read_excel("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/TOPUP  2023/TOPUP SEPTIEMBRE-2023.xlsx")
print(f"Columns: {list(topup.columns)}")
print(f"\nFirst 5 rows:")
print(topup.head())
print(f"\nData types:")
print(topup.dtypes)

# Inspect a BUNDLES file
print("\n\nBUNDLES FILE (SEPTIEMBRE 2023):")
print("="*80)
bundles = pd.read_excel("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/BUNDLES SEPTIEMBRE 2023.xlsx")
print(f"Columns: {list(bundles.columns)}")
print(f"\nFirst 5 rows:")
print(bundles.head())
print(f"\nData types:")
print(bundles.dtypes)

# Check if there's a correlation between transaction IDs
print("\n\nCHECKING TRANSACTION ID OVERLAP:")
print("="*80)
tf_ids = set(tf['SEC_ACTUACION'].astype(str))
topup_ids = set(topup['TransactionID'].astype(str))
bundles_ids = set(bundles['TransactionID'].astype(str))

print(f"Telefonica unique transaction IDs: {len(tf_ids):,}")
print(f"TOPUP unique transaction IDs: {len(topup_ids):,}")
print(f"BUNDLES unique transaction IDs: {len(bundles_ids):,}")

overlap_topup = tf_ids.intersection(topup_ids)
overlap_bundles = tf_ids.intersection(bundles_ids)

print(f"\nTransaction ID overlap (Telefonica & TOPUP): {len(overlap_topup):,}")
print(f"Transaction ID overlap (Telefonica & BUNDLES): {len(overlap_bundles):,}")

if overlap_topup:
    print(f"\nSample overlapping IDs (TOPUP): {list(overlap_topup)[:5]}")
if overlap_bundles:
    print(f"Sample overlapping IDs (BUNDLES): {list(overlap_bundles)[:5]}")

# Check phone number overlap
print("\n\nCHECKING PHONE NUMBER OVERLAP:")
print("="*80)
tf_phones = set(tf['NUM_TELEFONO'].astype(str))
topup_phones = set(topup['TargetMSISDN'].astype(str))
bundles_phones = set(bundles['TargetMSISDN'].astype(str))

print(f"Telefonica unique phone numbers: {len(tf_phones):,}")
print(f"TOPUP unique phone numbers: {len(topup_phones):,}")
print(f"BUNDLES unique phone numbers: {len(bundles_phones):,}")

overlap_topup_phones = tf_phones.intersection(topup_phones)
overlap_bundles_phones = tf_phones.intersection(bundles_phones)

print(f"\nPhone overlap (Telefonica & TOPUP): {len(overlap_topup_phones):,}")
print(f"Phone overlap (Telefonica & BUNDLES): {len(overlap_bundles_phones):,}")

# Check product code matching
print("\n\nCHECKING PRODUCT CODE OVERLAP:")
print("="*80)
tf_products = set(tf['COD_BONO'].astype(str))
topup_products = set(topup['Product'].astype(str))
bundles_products = set(bundles['Product'].astype(str))

print(f"Telefonica unique products: {sorted(tf_products)}")
print(f"TOPUP unique products (first 20): {sorted(topup_products)[:20]}")
print(f"BUNDLES unique products (first 20): {sorted(bundles_products)[:20]}")
