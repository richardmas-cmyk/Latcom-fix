#!/usr/bin/env python3
"""
FINAL Operator Transaction Reconciliation
Handles both date formats properly
"""

import pandas as pd
import os
from datetime import datetime
import glob

print("=" * 80)
print("🔍 FINAL OPERATOR TRANSACTION RECONCILIATION")
print("=" * 80)

# ============================================
# STEP 1: Load Operator Claims with proper date handling
# ============================================
print("\n📂 Loading operator files...")

op1 = pd.read_csv("/Users/richardmas/Desktop/Operator_Transactions202309_202312.csv", encoding='utf-8-sig')
op2 = pd.read_csv("/Users/richardmas/Desktop/Operator_Transactions_NoSoporteActual_202309_202412.csv", encoding='utf-8-sig')

# Standardize file 1
op1.rename(columns={'TransactionID': 'VENDOR_TRANSACTION_ID',
                    'TargetMSISDN': 'MSISDN',
                    'TransactionAmountUSD': 'AMOUNT',
                    'FECHA': 'DATE_RAW'}, inplace=True)

# Parse date format 1: YYYYMMDD (numeric)
op1['DATE'] = pd.to_datetime(op1['DATE_RAW'], format='%Y%m%d', errors='coerce')

# Standardize file 2
op2.rename(columns={'SEC_ACTUACION': 'VENDOR_TRANSACTION_ID',
                    'NUM_TELEFONO': 'MSISDN',
                    'ImpUSD': 'AMOUNT',
                    'FECHA': 'DATE_RAW'}, inplace=True)

# Parse date format 2: DD/MM/YYYY (text)
op2['DATE'] = pd.to_datetime(op2['DATE_RAW'], format='%d/%m/%Y', errors='coerce')

# Combine
operator_claims = pd.concat([op1, op2], ignore_index=True)

print(f"   ✅ Total claims: {len(operator_claims):,} transactions")
print(f"   Total USD: ${operator_claims['AMOUNT'].sum():,.2f}")
print(f"   Dates parsed: {operator_claims['DATE'].notna().sum():,}")
print(f"   Missing dates: {operator_claims['DATE'].isna().sum():,}")

# Extract year-month
operator_claims['YEAR'] = operator_claims['DATE'].dt.year
operator_claims['MONTH'] = operator_claims['DATE'].dt.month
operator_claims['YEAR_MONTH'] = operator_claims['DATE'].dt.to_period('M')

# ============================================
# STEP 2: Load Company Records
# ============================================
print("\n📂 Loading company records...")

all_records = []
for file in glob.glob(f"{os.path.expanduser('~')}/Downloads/Excel Workings/2023/*.xlsx"):
    if '~$' not in file:
        all_records.append(pd.read_excel(file))

for file in glob.glob(f"{os.path.expanduser('~')}/Downloads/Excel Workings/2024/*.xlsx"):
    if '~$' not in file:
        all_records.append(pd.read_excel(file))

company_df = pd.concat(all_records, ignore_index=True)

# Filter to dispute period
company_df['DATETIME'] = pd.to_datetime(company_df['DATETIME'], errors='coerce', utc=True)
company_df['DATETIME'] = company_df['DATETIME'].dt.tz_localize(None)
company_df['DATE'] = company_df['DATETIME'].dt.date

start_date = pd.to_datetime('2023-09-01').date()
end_date = pd.to_datetime('2024-12-31').date()

company_df = company_df[
    (company_df['DATE'] >= start_date) &
    (company_df['DATE'] <= end_date)
].copy()

print(f"   ✅ Loaded {len(company_df):,} records in dispute period")

# ============================================
# STEP 3: Matching
# ============================================
print("\n🔍 Matching transactions...")

# Clean data
def clean_phone(phone):
    if pd.isna(phone):
        return ''
    phone_str = str(phone).strip()
    phone_str = phone_str.replace('+52', '').replace('52', '', 1)
    phone_str = phone_str.replace(' ', '').replace('-', '').replace('+', '')
    return phone_str[-10:] if len(phone_str) >= 10 else phone_str

operator_claims['PHONE_CLEAN'] = operator_claims['MSISDN'].apply(clean_phone)
company_df['PHONE_CLEAN'] = company_df['MSISDN'].apply(clean_phone)

operator_claims['TX_ID_CLEAN'] = operator_claims['VENDOR_TRANSACTION_ID'].astype(str).str.strip().str.upper()
company_df['TX_ID_CLEAN'] = company_df['VENDOR_TRANSACTION_ID'].astype(str).str.strip().str.upper()

# Match by transaction ID
results = operator_claims.merge(
    company_df[['TX_ID_CLEAN', 'STATUS', 'RESPONSE_MESSAGE', 'VENDOR_RESPONSE_MESSAGE',
                'TRANSACTION_ID', 'AMOUNT']],
    on='TX_ID_CLEAN',
    how='left',
    suffixes=('_OPERATOR', '_COMPANY')
)

# Categorize
matched = results[results['STATUS'].notna()]
not_found = results[results['STATUS'].isna()]

successful = matched[matched['STATUS'] == 'Success']
failed = matched[matched['STATUS'] == 'Fail']

# ============================================
# TEMPORAL ANALYSIS OF NOT FOUND
# ============================================
print("\n" + "=" * 80)
print("📅 TEMPORAL ANALYSIS OF NOT FOUND TRANSACTIONS")
print("=" * 80)

not_found_with_dates = not_found[not_found['DATE'].notna()]

print(f"\nNOT FOUND transactions: {len(not_found):,}")
print(f"   With dates: {len(not_found_with_dates):,}")
print(f"   Without dates: {len(not_found) - len(not_found_with_dates):,}")

if len(not_found_with_dates) > 0:
    print("\n📊 BY YEAR:")
    year_breakdown = not_found_with_dates.groupby('YEAR').agg({
        'AMOUNT_OPERATOR': ['count', 'sum']
    }).round(2)

    for year in sorted(not_found_with_dates['YEAR'].dropna().unique()):
        count = len(not_found_with_dates[not_found_with_dates['YEAR'] == year])
        total = not_found_with_dates[not_found_with_dates['YEAR'] == year]['AMOUNT_OPERATOR'].sum()
        pct = (count / len(not_found_with_dates)) * 100
        print(f"   {int(year)}: {count:>10,} transactions (${total:>12,.2f}) - {pct:>5.1f}%")

    print("\n📊 TOP 10 MONTHS:")
    month_breakdown = not_found_with_dates.groupby('YEAR_MONTH').agg({
        'AMOUNT_OPERATOR': ['count', 'sum']
    }).sort_values(by=('AMOUNT_OPERATOR', 'count'), ascending=False)

    for idx, (period, data) in enumerate(month_breakdown.head(10).iterrows(), 1):
        count = int(data[('AMOUNT_OPERATOR', 'count')])
        total = data[('AMOUNT_OPERATOR', 'sum')]
        pct = (count / len(not_found_with_dates)) * 100
        print(f"   {idx:2}. {str(period)}: {count:>8,} transactions (${total:>12,.2f}) - {pct:>5.1f}%")

# ============================================
# FINAL REPORT
# ============================================
print("\n" + "=" * 80)
print("📋 FINAL RECONCILIATION REPORT")
print("=" * 80)

print(f"\n🔢 OPERATOR CLAIMS:")
print(f"   Total transactions: {len(operator_claims):,}")
print(f"   Total USD: ${operator_claims['AMOUNT'].sum():,.2f}")

print(f"\n✅ VERIFIED SUCCESSFUL (You likely owe):")
print(f"   Transactions: {len(successful):,}")
print(f"   Total USD: ${successful['AMOUNT_OPERATOR'].sum():,.2f}")

print(f"\n❌ DISPUTED - FAILED:")
print(f"   Transactions: {len(failed):,}")
print(f"   Total USD: ${failed['AMOUNT_OPERATOR'].sum():,.2f}")
if len(failed) > 0:
    print(f"\n   Failure reasons:")
    for reason, count in failed['VENDOR_RESPONSE_MESSAGE'].value_counts().head(3).items():
        print(f"      {reason}: {count:,}")

print(f"\n⚠️  NOT FOUND:")
print(f"   Transactions: {len(not_found):,}")
print(f"   Total USD: ${not_found['AMOUNT_OPERATOR'].sum():,.2f}")

# Most problematic period
if len(not_found_with_dates) > 0:
    top_month = not_found_with_dates.groupby('YEAR_MONTH').size().idxmax()
    top_month_count = not_found_with_dates.groupby('YEAR_MONTH').size().max()
    print(f"\n   🚨 Most problematic month: {top_month}")
    print(f"      {top_month_count:,} missing transactions ({top_month_count/len(not_found_with_dates)*100:.1f}%)")

print(f"\n💰 BOTTOM LINE:")
print(f"   Operator claims:     ${operator_claims['AMOUNT'].sum():,.2f}")
print(f"   You likely owe:      ${successful['AMOUNT_OPERATOR'].sum():,.2f}")
print(f"   Total disputed:      ${failed['AMOUNT_OPERATOR'].sum() + not_found['AMOUNT_OPERATOR'].sum():,.2f}")
print(f"   Potential savings:   ${failed['AMOUNT_OPERATOR'].sum() + not_found['AMOUNT_OPERATOR'].sum():,.2f}")

# ============================================
# Save Reports
# ============================================
output_dir = "/Users/richardmas/latcom-fix/reconciliation_reports"
os.makedirs(output_dir, exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# Save temporal analysis of NOT FOUND
if len(not_found_with_dates) > 0:
    temporal_file = f"{output_dir}/NOT_FOUND_BY_MONTH_{timestamp}.csv"
    temporal_summary = not_found_with_dates.groupby('YEAR_MONTH').agg({
        'AMOUNT_OPERATOR': ['count', 'sum', 'mean', 'min', 'max']
    }).round(2)
    temporal_summary.columns = ['COUNT', 'TOTAL_USD', 'AVG_USD', 'MIN_USD', 'MAX_USD']
    temporal_summary.to_csv(temporal_file)
    print(f"\n💾 Temporal analysis: {temporal_file}")

print("\n" + "=" * 80)
print("✅ ANALYSIS COMPLETE!")
print("=" * 80)
