"""
Telefonica Reconciliation Script for 2023 - Version 2
Per meeting requirements from transcript

Meeting notes:
- Speaker 0: "la idea es que hagas la la comparación contra lo que pone ahí ajustado"
- Luis: "Todas las que están aquí tienen que estar en telefónica"
- Need to cross-reference using VENDOR_TRANSACTION_ID (SEC_ACTUACION in TEMM)
- Month by month: September, October, November, December 2023
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /Registros_TEMM_NoSoporteActual_202309_202412.csv'
OCT_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL OCTUBRE 20231.xlsx'
DEC_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL DICIEMBRE 2023.xlsx'

OUTPUT_FILE = '/Users/richardmas/latcom-fix/RECONCILIATION_2023_TELEFONICA_vs_LATCOM.xlsx'

print('=' * 120)
print('TELEFONICA RECONCILIATION - 2023')
print('Comparing: TEMM (Telefonica claims) vs Latcom Adjusted (reported sales)')
print('=' * 120)

# Step 1: Read TEMM file
print('\n📦 Reading Telefonica TEMM file...')
df_temm = pd.read_csv(TEMM_FILE)
df_temm['FECHA'] = pd.to_datetime(df_temm['FECHA'], format='%d/%m/%Y')
df_temm['Year'] = df_temm['FECHA'].dt.year
df_temm['Month'] = df_temm['FECHA'].dt.month
df_temm_2023 = df_temm[df_temm['Year'] == 2023].copy()

print(f'   Total 2023 records: {len(df_temm_2023):,}')
print(f'   Total amount: ${df_temm_2023["ImpUSD"].sum():,.2f} USD')

# Group by month
print('\n   By month:')
for month in [9, 10, 11, 12]:
    month_data = df_temm_2023[df_temm_2023['Month'] == month]
    month_name = ['Sep', 'Oct', 'Nov', 'Dec'][month-9]
    print(f'      {month_name}: {len(month_data):,} transactions (${month_data["ImpUSD"].sum():,.2f} USD)')

# Step 2: Read Latcom files
print('\n📦 Reading Latcom reconciliation files...')

# We only have October and December files
files_data = {
    10: {'file': OCT_FILE, 'name': 'October'},
    12: {'file': DEC_FILE, 'name': 'December'}
}

latcom_data = {}
for month, info in files_data.items():
    df_adj = pd.read_excel(info['file'], sheet_name='ADJUSTED')
    df_real = pd.read_excel(info['file'], sheet_name=list(pd.read_excel(info['file'], sheet_name=None).keys())[2])  # Third sheet

    latcom_data[month] = {
        'adjusted': df_adj,
        'real': df_real
    }

    print(f'   {info["name"]}:')
    print(f'      Adjusted (reported): {len(df_adj):,} transactions (${df_adj["TransactionAmountUSD"].sum():,.2f} USD)')
    print(f'      Real (all): {len(df_real):,} transactions (${df_real["TransactionAmountUSD"].sum():,.2f} USD)')

# Step 3: Reconciliation
print('\n' + '=' * 120)
print('RECONCILIATION ANALYSIS')
print('=' * 120)

results = {}

for month in [10, 12]:
    month_name = ['Sep', 'Oct', 'Nov', 'Dec'][month-9]

    print(f'\n📅 {month_name.upper()} 2023')
    print('-' * 120)

    # Get data
    df_temm_month = df_temm_2023[df_temm_2023['Month'] == month].copy()
    df_latcom_adj = latcom_data[month]['adjusted'].copy()
    df_latcom_real = latcom_data[month]['real'].copy()

    # Clean IDs for matching
    df_temm_month['SEC_ACT_STR'] = df_temm_month['SEC_ACTUACION'].astype(str).str.strip()
    df_latcom_adj['VEND_TX_STR'] = df_latcom_adj['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()
    df_latcom_real['VEND_TX_STR'] = df_latcom_real['VENDOR_TRANSACTION_ID'].astype(str).str.split('.').str[0].str.strip()

    # Create sets
    temm_ids = set(df_temm_month['SEC_ACT_STR'])
    latcom_adj_ids = set(df_latcom_adj['VEND_TX_STR'])
    latcom_real_ids = set(df_latcom_real['VEND_TX_STR'])

    # Find matches
    matched_adj = temm_ids & latcom_adj_ids  # In both TEMM and Adjusted
    matched_real = temm_ids & latcom_real_ids  # In both TEMM and Real

    only_temm = temm_ids - latcom_real_ids  # In TEMM but not in our real data (FAILED)
    only_latcom_adj = latcom_adj_ids - temm_ids  # We reported but TEMM doesn't have
    only_latcom_real = latcom_real_ids - temm_ids  # In our real but not in TEMM

    # Get dataframes
    df_matched_temm = df_temm_month[df_temm_month['SEC_ACT_STR'].isin(matched_adj)]
    df_matched_latcom = df_latcom_adj[df_latcom_adj['VEND_TX_STR'].isin(matched_adj)]
    df_failed_temm = df_temm_month[df_temm_month['SEC_ACT_STR'].isin(only_temm)]

    # Print results
    print(f'\n1️⃣  TELEFONICA CLAIMS:')
    print(f'   Total: {len(df_temm_month):,} transactions (${df_temm_month["ImpUSD"].sum():,.2f} USD)')

    print(f'\n2️⃣  LATCOM REPORTED (Adjusted):')
    print(f'   Total: {len(df_latcom_adj):,} transactions (${df_latcom_adj["TransactionAmountUSD"].sum():,.2f} USD)')

    print(f'\n3️⃣  MATCHING:')
    print(f'   ✅ Matched (Conciliadas): {len(matched_adj):,} transactions')
    print(f'   💰 Matched amount: ${df_matched_latcom["TransactionAmountUSD"].sum():,.2f} USD')
    match_rate = (len(matched_adj) / len(df_latcom_adj) * 100) if len(df_latcom_adj) > 0 else 0
    print(f'   📊 Match rate: {match_rate:.2f}% (of Latcom reported)')

    print(f'\n4️⃣  DISCREPANCIES:')
    print(f'   ❌ Failed (in TEMM, not in our system): {len(only_temm):,} transactions')
    print(f'   💰 Failed amount: ${df_failed_temm["ImpUSD"].sum():,.2f} USD')
    print(f'   ⚠️  In Latcom but not in TEMM: {len(only_latcom_adj):,} transactions')

    print(f'\n5️⃣  AUDIT (vs Real data):')
    print(f'   Real transactions: {len(df_latcom_real):,}')
    print(f'   Matched with TEMM: {len(matched_real):,}')
    print(f'   In real but not TEMM: {len(only_latcom_real):,}')

    # Calculate what was removed
    removed_count = len(df_latcom_real) - len(df_latcom_adj)
    removed_pct = (removed_count / len(df_latcom_real) * 100) if len(df_latcom_real) > 0 else 0
    print(f'   🗑️  Removed for reporting: {removed_count:,} ({removed_pct:.1f}%)')

    # Store results
    results[month] = {
        'month_name': month_name,
        'temm': df_temm_month,
        'latcom_adjusted': df_latcom_adj,
        'latcom_real': df_latcom_real,
        'matched_temm': df_matched_temm,
        'matched_latcom': df_matched_latcom,
        'failed': df_failed_temm,
        'stats': {
            'temm_count': len(df_temm_month),
            'temm_usd': df_temm_month['ImpUSD'].sum(),
            'adj_count': len(df_latcom_adj),
            'adj_usd': df_latcom_adj['TransactionAmountUSD'].sum(),
            'matched_count': len(matched_adj),
            'matched_usd': df_matched_latcom['TransactionAmountUSD'].sum(),
            'failed_count': len(only_temm),
            'failed_usd': df_failed_temm['ImpUSD'].sum()
        }
    }

# Step 4: Create Excel output
print('\n' + '=' * 120)
print('CREATING EXCEL REPORT')
print('=' * 120)

with pd.ExcelWriter(OUTPUT_FILE, engine='xlsxwriter') as writer:
    workbook = writer.book

    # Formats
    header_fmt = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': 'white', 'border': 1})
    matched_fmt = workbook.add_format({'bg_color': '#C6EFCE', 'border': 1})
    failed_fmt = workbook.add_format({'bg_color': '#FFC7CE', 'border': 1})
    money_fmt = workbook.add_format({'num_format': '$#,##0.00', 'border': 1})

    # Summary sheet
    summary_rows = []
    for month in sorted(results.keys()):
        r = results[month]
        summary_rows.append({
            'Month': r['month_name'],
            'Telefonica_Count': r['stats']['temm_count'],
            'Telefonica_USD': r['stats']['temm_usd'],
            'Latcom_Reported_Count': r['stats']['adj_count'],
            'Latcom_Reported_USD': r['stats']['adj_usd'],
            'Matched_Count': r['stats']['matched_count'],
            'Matched_USD': r['stats']['matched_usd'],
            'Failed_Count': r['stats']['failed_count'],
            'Failed_USD': r['stats']['failed_usd'],
            'Match_Rate_%': (r['stats']['matched_count'] / r['stats']['adj_count'] * 100) if r['stats']['adj_count'] > 0 else 0
        })

    # Add totals
    summary_rows.append({
        'Month': 'TOTAL',
        'Telefonica_Count': sum(r['stats']['temm_count'] for r in results.values()),
        'Telefonica_USD': sum(r['stats']['temm_usd'] for r in results.values()),
        'Latcom_Reported_Count': sum(r['stats']['adj_count'] for r in results.values()),
        'Latcom_Reported_USD': sum(r['stats']['adj_usd'] for r in results.values()),
        'Matched_Count': sum(r['stats']['matched_count'] for r in results.values()),
        'Matched_USD': sum(r['stats']['matched_usd'] for r in results.values()),
        'Failed_Count': sum(r['stats']['failed_count'] for r in results.values()),
        'Failed_USD': sum(r['stats']['failed_usd'] for r in results.values()),
        'Match_Rate_%': ''
    })

    df_summary = pd.DataFrame(summary_rows)
    df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

    # Format summary
    worksheet = writer.sheets['SUMMARY']
    for col_num, value in enumerate(df_summary.columns.values):
        worksheet.write(0, col_num, value, header_fmt)
        worksheet.set_column(col_num, col_num, 18)

    # Month sheets
    for month in sorted(results.keys()):
        r = results[month]
        prefix = r['month_name'][:3].upper()

        # 1. Telefonica data
        r['temm'].to_excel(writer, sheet_name=f'{prefix}_1_TELEFONICA', index=False)

        # 2. Latcom Adjusted
        r['latcom_adjusted'].to_excel(writer, sheet_name=f'{prefix}_2_LATCOM_ADJ', index=False)

        # 3. Latcom Real (audit)
        r['latcom_real'].to_excel(writer, sheet_name=f'{prefix}_3_LATCOM_REAL', index=False)

        # 4. Matched transactions
        r['matched_latcom'].to_excel(writer, sheet_name=f'{prefix}_4_MATCHED', index=False)

        # 5. Failed transactions with default cause
        df_failed = r['failed'].copy()
        df_failed['FAILURE_REASON'] = 'TIMEOUT'  # Default per meeting
        df_failed['NOTES'] = 'Transaction claimed by Telefonica but not in Latcom system'
        df_failed.to_excel(writer, sheet_name=f'{prefix}_5_FAILED', index=False)

print(f'\n✅ Excel report created: {OUTPUT_FILE}')

# Print final summary
print('\n' + '=' * 120)
print('FINAL SUMMARY - 2023 (Oct + Dec only)')
print('=' * 120)

total_temm_count = sum(r['stats']['temm_count'] for r in results.values())
total_temm_usd = sum(r['stats']['temm_usd'] for r in results.values())
total_adj_count = sum(r['stats']['adj_count'] for r in results.values())
total_adj_usd = sum(r['stats']['adj_usd'] for r in results.values())
total_matched_count = sum(r['stats']['matched_count'] for r in results.values())
total_matched_usd = sum(r['stats']['matched_usd'] for r in results.values())
total_failed_count = sum(r['stats']['failed_count'] for r in results.values())
total_failed_usd = sum(r['stats']['failed_usd'] for r in results.values())

print(f'\nTelefonica claims: {total_temm_count:,} transactions (${total_temm_usd:,.2f} USD)')
print(f'Latcom reported: {total_adj_count:,} transactions (${total_adj_usd:,.2f} USD)')
print(f'Matched (Conciliadas): {total_matched_count:,} transactions (${total_matched_usd:,.2f} USD)')
print(f'Failed (Fallidas): {total_failed_count:,} transactions (${total_failed_usd:,.2f} USD)')
print(f'\nOverall match rate: {(total_matched_count/total_adj_count*100):.2f}%')
print(f'Difference to explain: ${total_failed_usd:,.2f} USD')

print('\n⚠️  NOTE: September and November data files not provided - reconciliation incomplete')
print('=' * 120)
