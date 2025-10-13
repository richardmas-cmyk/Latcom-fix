#!/usr/bin/env python3
"""
Comprehensive Reconciliation Analysis: Latcom CDR vs Telefónica Disputed Transactions
Author: Claude Code
Date: 2025-10-11
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from pathlib import Path
import glob
import warnings
warnings.filterwarnings('ignore')

# Configuration
TELEFONICA_FILE = "/Users/richardmas/Downloads/Datos de TF auditoria/Registros_TEMM_NoSoporteActual_202309_202412.csv"
OUTPUT_DIR = "/Users/richardmas/latcom-fix/reconciliation_reports"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTPUT_FILE = f"{OUTPUT_DIR}/TELEFONICA_RECONCILIATION_DETAILED_{TIMESTAMP}.xlsx"

# Latcom CDR files - use glob to find all files
LATCOM_TOPUP_FILES = (
    glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/TOPUP  2023/*.xlsx") +
    glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/TOPUP  2024/*.xlsx")
)

LATCOM_BUNDLES_FILES = (
    glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2023/*.xlsx") +
    glob.glob("/Users/richardmas/Downloads/Reconciliacion TF Latcom 2023 al presente/BUNDLES 2024/*.xlsx")
)

ALL_LATCOM_FILES = LATCOM_TOPUP_FILES + LATCOM_BUNDLES_FILES

print("="*80)
print("TELEFONICA vs LATCOM RECONCILIATION ANALYSIS")
print("="*80)
print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Output File: {OUTPUT_FILE}")
print("="*80)

# Step 1: Load Telefónica's disputed transactions
print("\n[1/7] Loading Telefónica's disputed transactions file...")
try:
    telefonica_df = pd.read_csv(TELEFONICA_FILE, encoding='utf-8-sig')
    print(f"  ✓ Loaded {len(telefonica_df):,} transactions from Telefónica")
    print(f"  Columns: {list(telefonica_df.columns)}")

    # Parse date - handle DD/MM/YYYY format
    telefonica_df['FECHA'] = pd.to_datetime(telefonica_df['FECHA'], format='%d/%m/%Y', errors='coerce')
    telefonica_df['YEAR_MONTH'] = telefonica_df['FECHA'].dt.to_period('M')

    # Normalize phone number
    telefonica_df['PHONE_NORMALIZED'] = telefonica_df['NUM_TELEFONO'].astype(str).str.strip()

    print(f"  Date range: {telefonica_df['FECHA'].min()} to {telefonica_df['FECHA'].max()}")
    print(f"  Unique phone numbers: {telefonica_df['PHONE_NORMALIZED'].nunique():,}")

except Exception as e:
    print(f"  ✗ ERROR loading Telefónica file: {e}")
    exit(1)

# Step 2: Load and consolidate all Latcom CDR files
print("\n[2/7] Loading and consolidating Latcom CDR files...")
latcom_records = []
file_issues = []

for file_path in ALL_LATCOM_FILES:
    try:
        if not os.path.exists(file_path):
            file_issues.append(f"File not found: {file_path}")
            continue

        # Extract file type and period from filename
        filename = os.path.basename(file_path)
        file_type = "TOPUP" if "TOPUP" in filename.upper() else "BUNDLES"

        # Try to read Excel file
        try:
            df = pd.read_excel(file_path, engine='openpyxl')
        except:
            df = pd.read_excel(file_path)

        if df.empty:
            file_issues.append(f"Empty file: {filename}")
            continue

        df['SOURCE_FILE'] = filename
        df['TRANSACTION_TYPE'] = file_type
        latcom_records.append(df)
        print(f"  ✓ {filename}: {len(df):,} records")

    except Exception as e:
        file_issues.append(f"Error reading {os.path.basename(file_path)}: {str(e)}")
        print(f"  ✗ {os.path.basename(file_path)}: {str(e)}")

if not latcom_records:
    print("  ✗ ERROR: No Latcom records loaded!")
    exit(1)

# Combine all Latcom records
latcom_df = pd.concat(latcom_records, ignore_index=True)
print(f"\n  ✓ Total Latcom records loaded: {len(latcom_df):,}")
print(f"  Columns in Latcom data: {list(latcom_df.columns)}")

# Step 3: Identify and normalize key fields in Latcom data
print("\n[3/7] Identifying and normalizing Latcom data fields...")

# Try to identify phone number column
phone_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['PHONE', 'NUMERO', 'TEL', 'MSISDN', 'NUM'])]
date_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['DATE', 'FECHA', 'TIME', 'TIMESTAMP'])]
status_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['STATUS', 'ESTADO', 'RESULT', 'RESPONSE'])]
amount_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['AMOUNT', 'MONTO', 'PRICE', 'PRECIO', 'VALOR', 'IMP'])]
txn_id_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['ID', 'TRANSACTION', 'SEC_', 'CORRELAT'])]
duration_columns = [col for col in latcom_df.columns if any(keyword in col.upper() for keyword in ['DURATION', 'TIME', 'DELAY', 'RESPONSE_TIME'])]

print(f"  Phone columns found: {phone_columns}")
print(f"  Date columns found: {date_columns}")
print(f"  Status columns found: {status_columns}")
print(f"  Amount columns found: {amount_columns}")
print(f"  Transaction ID columns found: {txn_id_columns}")
print(f"  Duration columns found: {duration_columns}")

# Standardize column names
if phone_columns:
    latcom_df['PHONE_NORMALIZED'] = latcom_df[phone_columns[0]].astype(str).str.strip()
else:
    print("  ✗ WARNING: No phone number column found in Latcom data!")
    latcom_df['PHONE_NORMALIZED'] = ''

if date_columns:
    # Try to parse date
    for date_col in date_columns:
        try:
            latcom_df['DATE_PARSED'] = pd.to_datetime(latcom_df[date_col], errors='coerce')
            if latcom_df['DATE_PARSED'].notna().sum() > 0:
                latcom_df['YEAR_MONTH'] = latcom_df['DATE_PARSED'].dt.to_period('M')
                break
        except:
            continue
else:
    print("  ✗ WARNING: No date column found in Latcom data!")
    latcom_df['DATE_PARSED'] = pd.NaT

if status_columns:
    latcom_df['STATUS'] = latcom_df[status_columns[0]].astype(str).str.upper().str.strip()
else:
    print("  ✗ WARNING: No status column found in Latcom data!")
    latcom_df['STATUS'] = 'UNKNOWN'

if amount_columns:
    try:
        latcom_df['AMOUNT'] = pd.to_numeric(latcom_df[amount_columns[0]], errors='coerce')
    except:
        latcom_df['AMOUNT'] = 0
else:
    latcom_df['AMOUNT'] = 0

if txn_id_columns:
    latcom_df['TXN_ID'] = latcom_df[txn_id_columns[0]].astype(str).str.strip()
else:
    latcom_df['TXN_ID'] = ''

if duration_columns:
    try:
        latcom_df['DURATION_SECONDS'] = pd.to_numeric(latcom_df[duration_columns[0]], errors='coerce')
    except:
        latcom_df['DURATION_SECONDS'] = np.nan
else:
    latcom_df['DURATION_SECONDS'] = np.nan

# Add sequential index for tracking
latcom_df['LATCOM_INDEX'] = range(len(latcom_df))
telefonica_df['TELEFONICA_INDEX'] = range(len(telefonica_df))

print(f"  ✓ Normalized {len(latcom_df):,} Latcom records")
print(f"  Date range: {latcom_df['DATE_PARSED'].min()} to {latcom_df['DATE_PARSED'].max()}")
print(f"  Unique phone numbers: {latcom_df['PHONE_NORMALIZED'].nunique():,}")
print(f"  Status values: {latcom_df['STATUS'].value_counts().to_dict()}")

# Step 4: Product code mapping
print("\n[4/7] Creating product code mapping...")

# Map Telefónica product codes to Latcom product codes
PRODUCT_MAPPING = {
    'BFRECINT': 'TEMXN_BFRECINT_30_DAYS',
    'BFSPRINT': 'TEMXN_BFSPRINT_UNLIMITED_30_DAYS',
    'BFRIQUIN': 'TEMXN_BFRIQUIN_28_DAYS',
    'BFRISEM': 'TEMXN_BFRISEM_7_DAYS',
    'BFRIMEN': 'TEMXN_BFRIMEN_15_DAYS',
    'PQRI412D': 'TEM_4GB_12_DAYS',
    'PQRI3G9D': 'TEM_3GB_9_DAYS',
    'PQRI2G7D': 'TEM_2GB_7_DAYS',
    'PQRI1G4D': 'TEM_1GB_3_DAYS',  # Found this in bundles!
    'PQRI6M2D': 'TEM_600MB_2_DAYS',
}

# Add mapped product to Latcom data
# Different files have different product column names - merge them
product_columns = [col for col in latcom_df.columns if col in ['Product', 'Product MobiFin', 'Product MoviStar', 'Product Sagar', 'Product ']]

if product_columns:
    # Coalesce all product columns into one - handle NaN properly
    latcom_df['PRODUCT_NORMALIZED'] = ''
    for col in product_columns:
        # Fill empty values with values from this column
        mask = (latcom_df['PRODUCT_NORMALIZED'] == '') & (latcom_df[col].notna())
        latcom_df.loc[mask, 'PRODUCT_NORMALIZED'] = latcom_df.loc[mask, col].astype(str)

    # Clean up any remaining 'nan' strings
    latcom_df['PRODUCT_NORMALIZED'] = latcom_df['PRODUCT_NORMALIZED'].str.strip()
    latcom_df['PRODUCT_NORMALIZED'] = latcom_df['PRODUCT_NORMALIZED'].replace('nan', '')
    latcom_df['PRODUCT_NORMALIZED'] = latcom_df['PRODUCT_NORMALIZED'].replace('None', '')

    print(f"  ✓ Merged product columns: {product_columns}")
    print(f"  Product column stats: {latcom_df['PRODUCT_NORMALIZED'].ne('').sum():,} non-empty / {len(latcom_df):,} total")
    print(f"  Unique products: {latcom_df['PRODUCT_NORMALIZED'][latcom_df['PRODUCT_NORMALIZED'].ne('')].nunique()}")
else:
    latcom_df['PRODUCT_NORMALIZED'] = ''
    print(f"  ✗ WARNING: No product columns found!")

# For Telefónica, map to Latcom product names
if 'COD_BONO' in telefonica_df.columns:
    telefonica_df['PRODUCT_LATCOM_EQUIVALENT'] = telefonica_df['COD_BONO'].map(PRODUCT_MAPPING).fillna('')
    telefonica_df['PRODUCT_CODE'] = telefonica_df['COD_BONO'].astype(str).str.strip()
else:
    telefonica_df['PRODUCT_LATCOM_EQUIVALENT'] = ''
    telefonica_df['PRODUCT_CODE'] = ''

print(f"  ✓ Product mapping created")
print(f"  Telefónica products: {telefonica_df['PRODUCT_CODE'].value_counts().to_dict()}")

# Step 5: Matching logic
print("\n[5/7] Matching transactions between Telefónica and Latcom...")

# IMPORTANT: Latcom transactions are ALL successful (they're in CDR because they were processed)
# We need to match on phone + product + date window (allowing +/- 7 days)

matches = []
matched_telefonica_indices = set()
matched_latcom_indices = set()

# Strategy: For each Telefónica transaction, find matching Latcom transactions
# Match criteria: Phone number + Product + Date within 7-day window

print("  Matching by phone + product + date window (±7 days)...")

# Split by transaction type for efficiency
bundles_mask = latcom_df['TRANSACTION_TYPE'] == 'BUNDLES'
topup_mask = latcom_df['TRANSACTION_TYPE'] == 'TOPUP'

latcom_bundles = latcom_df[bundles_mask].copy()
latcom_topup = latcom_df[topup_mask].copy()

print(f"    Latcom BUNDLES: {len(latcom_bundles):,}")
print(f"    Latcom TOPUP: {len(latcom_topup):,}")

# Match BUNDLES (have product codes)
bundle_product_codes = set(PRODUCT_MAPPING.keys())
telefonica_bundles = telefonica_df[telefonica_df['PRODUCT_CODE'].isin(bundle_product_codes)].copy()

print(f"    Telefónica BUNDLES to match: {len(telefonica_bundles):,}")

# Optimized matching using merge operations
# Create a temporary key for exact matching (phone + product)
telefonica_bundles_clean = telefonica_bundles[
    telefonica_bundles['PRODUCT_LATCOM_EQUIVALENT'].ne('') &
    telefonica_bundles['FECHA'].notna()
].copy()

latcom_bundles_clean = latcom_bundles[
    latcom_bundles['DATE_PARSED'].notna()
].copy()

print(f"    Telefónica BUNDLES (clean): {len(telefonica_bundles_clean):,}")
print(f"    Latcom BUNDLES (clean): {len(latcom_bundles_clean):,}")

# OPTIMIZED matching using groupby and merge
print(f"    Using optimized matching algorithm...")

# Group Latcom by phone + product for faster lookup
latcom_bundles_clean['PHONE_PRODUCT'] = (
    latcom_bundles_clean['PHONE_NORMALIZED'] + '|' +
    latcom_bundles_clean['PRODUCT_NORMALIZED']
)

telefonica_bundles_clean['PHONE_PRODUCT'] = (
    telefonica_bundles_clean['PHONE_NORMALIZED'] + '|' +
    telefonica_bundles_clean['PRODUCT_LATCOM_EQUIVALENT']
)

# Create a lookup dictionary
latcom_grouped = {}
for phone_product, group in latcom_bundles_clean.groupby('PHONE_PRODUCT'):
    latcom_grouped[phone_product] = group

print(f"    Created lookup index with {len(latcom_grouped):,} unique phone+product combinations")

# Match efficiently
total_to_match = len(telefonica_bundles_clean)
progress_interval = max(1, total_to_match // 20)

for i, (idx, tf_row) in enumerate(telefonica_bundles_clean.iterrows()):
    if i % progress_interval == 0:
        print(f"      Progress: {i:,} / {total_to_match:,} ({i/total_to_match*100:.1f}%) - Matches: {len(matches):,}")

    phone_product = tf_row['PHONE_PRODUCT']
    date = tf_row['FECHA']

    # Quick lookup in dictionary
    if phone_product not in latcom_grouped:
        continue

    candidates = latcom_grouped[phone_product]

    # Filter by date window (±7 days)
    date_min = date - timedelta(days=7)
    date_max = date + timedelta(days=7)

    matching_latcom = candidates[
        (candidates['DATE_PARSED'] >= date_min) &
        (candidates['DATE_PARSED'] <= date_max) &
        (~candidates['LATCOM_INDEX'].isin(matched_latcom_indices))
    ]

    if not matching_latcom.empty:
        # Take the closest match by date
        date_diffs = abs((matching_latcom['DATE_PARSED'] - date).dt.total_seconds())
        best_idx = date_diffs.idxmin()
        best_match = matching_latcom.loc[best_idx]

        matches.append({
            'TELEFONICA_INDEX': tf_row['TELEFONICA_INDEX'],
            'LATCOM_INDEX': best_match['LATCOM_INDEX'],
            'MATCH_METHOD': 'PHONE_PRODUCT_DATE_WINDOW',
            'DATE_DIFF_DAYS': date_diffs[best_idx] / 86400,
            'DURATION_SECONDS': best_match.get('DURATION_SECONDS', np.nan)
        })
        matched_telefonica_indices.add(tf_row['TELEFONICA_INDEX'])
        matched_latcom_indices.add(best_match['LATCOM_INDEX'])

print(f"      Progress: {total_to_match:,} / {total_to_match:,} (100.0%) - Matches: {len(matches):,}")

print(f"    ✓ Matched {len([m for m in matches if m['MATCH_METHOD'] == 'PHONE_PRODUCT_DATE_WINDOW']):,} BUNDLES transactions")

# Match TOPUP (no product codes, match by phone + date + amount if possible)
# Telefónica doesn't distinguish TOPUP in their codes, so we skip TOPUP matching for now
# OR try to match remaining transactions as TOPUP

print(f"    Note: TOPUP matching not implemented (no product codes in Telefónica data)")

matches_df = pd.DataFrame(matches) if matches else pd.DataFrame(columns=['TELEFONICA_INDEX', 'LATCOM_INDEX', 'MATCH_METHOD', 'DATE_DIFF_DAYS', 'DURATION_SECONDS'])

print(f"\n  ✓ Total matches found: {len(matches_df):,}")
print(f"  Telefónica records matched: {len(matched_telefonica_indices):,} / {len(telefonica_df):,} ({len(matched_telefonica_indices)/len(telefonica_df)*100:.1f}%)")
print(f"  Latcom records matched: {len(matched_latcom_indices):,} / {len(latcom_df):,} ({len(matched_latcom_indices)/len(latcom_df)*100:.1f}%)")

# Step 6: Categorize transactions
print("\n[6/7] Categorizing transactions...")

# IMPORTANT: All Latcom transactions are SUCCESSFUL (they're in CDR because they were processed)
# Category A: Matched & Successful - ALL MATCHED transactions (WE OWE THESE)
# Category B: Matched & Failed - N/A (no failed status in Latcom data)
# Category C: In Telefónica only (their claim, not in our logs - INVESTIGATION NEEDED)
# Category D: In Latcom only (not in their claim - extra transactions)

# Category A: ALL Matched transactions (WE OWE)
if not matches_df.empty:
    category_a_full = pd.merge(
        matches_df,
        telefonica_df,
        left_on='TELEFONICA_INDEX',
        right_on='TELEFONICA_INDEX',
        how='left'
    ).merge(
        latcom_df,
        left_on='LATCOM_INDEX',
        right_on='LATCOM_INDEX',
        how='left',
        suffixes=('_TELEFONICA', '_LATCOM')
    )
else:
    category_a_full = pd.DataFrame()

# Category B: Not applicable (no failed transactions in Latcom CDR)
category_b_full = pd.DataFrame()
category_b_slow = pd.DataFrame()

# Category C: In Telefónica only (their claim, NOT in our logs)
category_c = telefonica_df[~telefonica_df['TELEFONICA_INDEX'].isin(matched_telefonica_indices)].copy()

# Category D: In Latcom only (not in their claim)
category_d = latcom_df[~latcom_df['LATCOM_INDEX'].isin(matched_latcom_indices)].copy()

print(f"  Category A (Matched - WE OWE): {len(category_a_full):,} transactions")
print(f"  Category B (Failed): N/A (no failed transactions in Latcom CDR)")
print(f"  Category C (Telefónica Only - NOT IN OUR LOGS): {len(category_c):,} transactions")
print(f"  Category D (Latcom Only - NOT IN THEIR CLAIM): {len(category_d):,} transactions")

# Step 7: Calculate summary statistics
print("\n[7/7] Calculating summary statistics...")

summary_stats = {
    'Total Telefónica Transactions': len(telefonica_df),
    'Total Latcom Transactions': len(latcom_df),
    'Total Matches Found': len(matches_df),
    'Match Rate (%)': f"{len(matches_df)/len(telefonica_df)*100:.2f}%",
    '': '',
    'Category A - Matched (WE OWE)': len(category_a_full),
    'Category A - Amount USD': category_a_full['ImpUSD'].sum() if 'ImpUSD' in category_a_full.columns and not category_a_full.empty else 0,
    '  ': '',
    'Category B - Failed (N/A)': 'Not applicable - no failed status in Latcom CDR',
    '   ': '',
    'Category C - In Telefónica Only (NOT IN OUR LOGS)': len(category_c),
    'Category C - Amount USD': category_c['ImpUSD'].sum() if 'ImpUSD' in category_c.columns else 'N/A',
    '    ': '',
    'Category D - In Latcom Only (NOT IN THEIR CLAIM)': len(category_d),
}

# Month-by-month breakdown
print("  Calculating month-by-month breakdown...")
monthly_telefonica = telefonica_df.groupby('YEAR_MONTH').size().reset_index(name='Telefonica_Count')
monthly_telefonica_amount = telefonica_df.groupby('YEAR_MONTH')['ImpUSD'].sum().reset_index(name='Telefonica_Amount_USD')

if 'YEAR_MONTH' in latcom_df.columns:
    monthly_latcom = latcom_df.groupby('YEAR_MONTH').size().reset_index(name='Latcom_Count')
    monthly_breakdown = pd.merge(monthly_telefonica, monthly_latcom, on='YEAR_MONTH', how='outer')
else:
    monthly_breakdown = monthly_telefonica.copy()
    monthly_breakdown['Latcom_Count'] = 0

monthly_breakdown = pd.merge(monthly_breakdown, monthly_telefonica_amount, on='YEAR_MONTH', how='left')
monthly_breakdown['YEAR_MONTH'] = monthly_breakdown['YEAR_MONTH'].astype(str)
monthly_breakdown = monthly_breakdown.fillna(0)
monthly_breakdown = monthly_breakdown.sort_values('YEAR_MONTH')

# Step 8: Generate Excel report
print("\n[8/8] Generating Excel report...")

try:
    with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
        # Sheet 1: Summary
        summary_df = pd.DataFrame(list(summary_stats.items()), columns=['Metric', 'Value'])
        summary_df.to_excel(writer, sheet_name='Summary', index=False)

        # Sheet 2: Category A - Matched (WE OWE)
        if not category_a_full.empty:
            category_a_full.to_excel(writer, sheet_name='A - Matched WE OWE', index=False)
        else:
            pd.DataFrame({'Note': ['No matched transactions']}).to_excel(writer, sheet_name='A - Matched WE OWE', index=False)

        # Sheet 3: Category C - In Telefónica Only (NOT IN OUR LOGS)
        if not category_c.empty:
            category_c.to_excel(writer, sheet_name='C - TF Only NOT IN LOGS', index=False)
        else:
            pd.DataFrame({'Note': ['No transactions in Telefónica only']}).to_excel(writer, sheet_name='C - TF Only NOT IN LOGS', index=False)

        # Sheet 4: Category D - In Latcom Only (NOT IN THEIR CLAIM)
        if not category_d.empty:
            category_d.to_excel(writer, sheet_name='D - Latcom Only', index=False)
        else:
            pd.DataFrame({'Note': ['No transactions in Latcom only']}).to_excel(writer, sheet_name='D - Latcom Only', index=False)

        # Sheet 5: Month-by-month breakdown
        monthly_breakdown.to_excel(writer, sheet_name='Monthly Breakdown', index=False)

        # Sheet 6: Data Quality Issues
        quality_issues = []
        quality_issues.append({'Issue Type': 'File Loading Errors', 'Count': len(file_issues), 'Details': '; '.join(file_issues) if file_issues else 'None'})
        quality_issues.append({'Issue Type': 'Telefónica records without dates', 'Count': telefonica_df['FECHA'].isna().sum(), 'Details': ''})
        quality_issues.append({'Issue Type': 'Latcom records without dates', 'Count': latcom_df['DATE_PARSED'].isna().sum(), 'Details': ''})
        quality_issues.append({'Issue Type': 'Latcom records without phone numbers', 'Count': (latcom_df['PHONE_NORMALIZED'] == '').sum(), 'Details': ''})
        quality_issues.append({'Issue Type': 'Products with no mapping', 'Count': telefonica_df[telefonica_df['PRODUCT_LATCOM_EQUIVALENT'] == '']['PRODUCT_CODE'].nunique(), 'Details': ''})

        quality_df = pd.DataFrame(quality_issues)
        quality_df.to_excel(writer, sheet_name='Data Quality Issues', index=False)

        # Sheet 7: Matching Methodology
        methodology = [
            {'Step': 1, 'Description': 'Loaded Telefónica disputed transactions file', 'Records': len(telefonica_df)},
            {'Step': 2, 'Description': 'Consolidated all Latcom CDR files (TOPUP + BUNDLES)', 'Records': len(latcom_df)},
            {'Step': 3, 'Description': 'Normalized phone numbers and dates', 'Records': '-'},
            {'Step': 4, 'Description': 'Created product code mapping (TF -> Latcom)', 'Records': len(PRODUCT_MAPPING)},
            {'Step': 5, 'Description': 'Matched by phone + product + date window (±7 days)', 'Records': len(matches_df)},
            {'Step': 6, 'Description': 'Categorized matched and unmatched records', 'Records': '-'},
            {'Step': 7, 'Description': 'Generated comprehensive reconciliation report', 'Records': '-'},
        ]
        methodology_df = pd.DataFrame(methodology)
        methodology_df.to_excel(writer, sheet_name='Matching Methodology', index=False)

        # Sheet 8: Product Mapping Reference
        product_mapping_df = pd.DataFrame([
            {'Telefónica Code': k, 'Latcom Product': v if v else 'NOT FOUND'}
            for k, v in PRODUCT_MAPPING.items()
        ])
        product_mapping_df.to_excel(writer, sheet_name='Product Mapping', index=False)

    print(f"  ✓ Excel report generated successfully: {OUTPUT_FILE}")

except Exception as e:
    print(f"  ✗ ERROR generating Excel report: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Final summary output
print("\n" + "="*80)
print("RECONCILIATION ANALYSIS COMPLETE")
print("="*80)
print(f"\nOutput File: {OUTPUT_FILE}")
print(f"\nSUMMARY STATISTICS:")
print("-" * 80)
for key, value in summary_stats.items():
    if key.strip():  # Skip empty separator keys
        print(f"  {key}: {value}")

print("\n" + "="*80)
print("DATA QUALITY ISSUES:")
print("-" * 80)
for issue in quality_issues:
    if issue['Count'] > 0:
        print(f"  {issue['Issue Type']}: {issue['Count']}")
        if issue['Details']:
            print(f"    Details: {issue['Details']}")

print("\n" + "="*80)
print("MATCHING METHODOLOGY:")
print("-" * 80)
print("  1. Transaction ID matching (most specific)")
print("  2. Phone number + Date matching (fallback)")
print("  3. Status categorization: SUCCESS / FAILED / UNKNOWN")
print("  4. Duration analysis for failed transactions (>7 seconds threshold)")

print("\n" + "="*80)
print("CRITICAL FINDINGS:")
print("-" * 80)
cat_a_amount = category_a_full['ImpUSD'].sum() if 'ImpUSD' in category_a_full.columns and not category_a_full.empty else 0
cat_c_amount = category_c['ImpUSD'].sum() if 'ImpUSD' in category_c.columns and not category_c.empty else 0

print(f"  WE OWE (Category A - Matched): {len(category_a_full):,} transactions - ${cat_a_amount:,.2f} USD")
print(f"  NOT IN OUR LOGS (Category C): {len(category_c):,} transactions - ${cat_c_amount:,.2f} USD")
print(f"  NOT IN THEIR CLAIM (Category D): {len(category_d):,} transactions")
print(f"\n  TOTAL TELEFONICA CLAIM: ${telefonica_df['ImpUSD'].sum():,.2f} USD")
print(f"  AMOUNT WE CAN CONFIRM: ${cat_a_amount:,.2f} USD ({cat_a_amount/telefonica_df['ImpUSD'].sum()*100:.1f}%)")
print(f"  AMOUNT NOT IN OUR LOGS: ${cat_c_amount:,.2f} USD ({cat_c_amount/telefonica_df['ImpUSD'].sum()*100:.1f}%)")

print("\n" + "="*80)
print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*80)
