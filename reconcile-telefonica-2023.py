"""
Telefonica Reconciliation Script for 2023
Compares Telefonica TEMM file with Latcom adjusted transactions

Based on meeting transcript requirements:
- Compare TEMM (Telefonica data) with "Ajustado" (Latcom reported sales)
- Month by month comparison for Sept, Oct, Nov, Dec 2023
- Cross-reference using VENDOR_TRANSACTION_ID
- Identify matched, unmatched, and failed transactions
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os

# File paths
TEMM_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /Registros_TEMM_NoSoporteActual_202309_202412.csv'
OCT_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL OCTUBRE 20231.xlsx'
DEC_FILE = '/Users/richardmas/Downloads/Latcom/Ajustados 2023 Latcom /FINAL DICIEMBRE 2023.xlsx'

OUTPUT_FILE = '/Users/richardmas/latcom-fix/TELEFONICA_RECONCILIATION_2023.xlsx'

print('=' * 100)
print('TELEFONICA RECONCILIATION - 2023')
print('=' * 100)

# Step 1: Read TEMM file (Telefonica data)
print('\n📦 Step 1: Reading Telefonica TEMM file...')
df_temm = pd.read_csv(TEMM_FILE)
print(f'   Total TEMM records: {len(df_temm):,}')

# Parse dates - try multiple formats
def parse_date(date_str):
    for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y']:
        try:
            return pd.to_datetime(date_str, format=fmt)
        except:
            continue
    return pd.to_datetime(date_str)

df_temm['FECHA'] = df_temm['FECHA'].apply(parse_date)
df_temm['Year'] = df_temm['FECHA'].dt.year
df_temm['Month'] = df_temm['FECHA'].dt.month

# Filter 2023 data
df_temm_2023 = df_temm[df_temm['Year'] == 2023].copy()
print(f'   2023 TEMM records: {len(df_temm_2023):,}')

# Step 2: Read Latcom adjusted files
print('\n📦 Step 2: Reading Latcom adjusted files...')

# October 2023
df_oct = pd.read_excel(OCT_FILE, sheet_name='ADJUSTED')
df_oct_real = pd.read_excel(OCT_FILE, sheet_name='PAQUETES OCTUBRE23')
print(f'   October Adjusted: {len(df_oct):,} transactions')
print(f'   October Real: {len(df_oct_real):,} transactions')

# December 2023 (assuming September and November are in this file or similar structure)
df_dec = pd.read_excel(DEC_FILE, sheet_name='ADJUSTED')
df_dec_real = pd.read_excel(DEC_FILE, sheet_name='PAQUETES DICIEMBRE23')
print(f'   December Adjusted: {len(df_dec):,} transactions')
print(f'   December Real: {len(df_dec_real):,} transactions')

# Step 3: Reconciliation by month
print('\n' + '=' * 100)
print('RECONCILIATION BY MONTH')
print('=' * 100)

results_by_month = {}

# Define months to process
months_data = {
    9: {'name': 'September', 'adjusted': None, 'real': None},  # Need file
    10: {'name': 'October', 'adjusted': df_oct, 'real': df_oct_real},
    11: {'name': 'November', 'adjusted': None, 'real': None},  # Need file
    12: {'name': 'December', 'adjusted': df_dec, 'real': df_dec_real}
}

# For now, process October and December since we have those files
for month_num in [10, 12]:
    month_info = months_data[month_num]
    month_name = month_info['name']

    print(f'\n📅 Processing {month_name} 2023...')
    print('-' * 100)

    # Filter TEMM for this month
    df_temm_month = df_temm_2023[df_temm_2023['Month'] == month_num].copy()
    print(f'   Telefonica claims: {len(df_temm_month):,} transactions')
    print(f'   Total amount: ${df_temm_month["ImpUSD"].sum():,.2f} USD')

    # Get Latcom adjusted
    df_latcom_adjusted = month_info['adjusted']
    if df_latcom_adjusted is not None:
        print(f'   Latcom reported (adjusted): {len(df_latcom_adjusted):,} transactions')
        print(f'   Total amount: ${df_latcom_adjusted["TransactionAmountUSD"].sum():,.2f} USD')

        # Cross-reference using VENDOR_TRANSACTION_ID
        # TEMM: SEC_ACTUACION = Latcom: VENDOR_TRANSACTION_ID
        # Per meeting: "el vendor Transaction ID, porque Luis dice que este es el identificador que le sirve a Telefónica"

        # Clean VENDOR_TRANSACTION_ID values
        df_temm_month['SEC_ACTUACION_clean'] = df_temm_month['SEC_ACTUACION'].astype(str).str.strip()
        df_latcom_adjusted['VENDOR_TRANSACTION_ID_clean'] = df_latcom_adjusted['VENDOR_TRANSACTION_ID'].astype(str).str.replace('.0', '').str.strip()

        # Find matches
        latcom_keys = set(df_latcom_adjusted['VENDOR_TRANSACTION_ID_clean'])
        temm_keys = set(df_temm_month['SEC_ACTUACION_clean'])

        matched_keys = latcom_keys & temm_keys
        latcom_only = latcom_keys - temm_keys
        temm_only = temm_keys - latcom_keys

        print(f'\n   ✅ Matched: {len(matched_keys):,} transactions')
        print(f'   ⚠️  In Latcom but not in TEMM: {len(latcom_only):,}')
        print(f'   ⚠️  In TEMM but not in Latcom: {len(temm_only):,}')

        # Calculate differences
        matched_latcom = df_latcom_adjusted[df_latcom_adjusted['VENDOR_TRANSACTION_ID_clean'].isin(matched_keys)]
        matched_temm = df_temm_month[df_temm_month['SEC_ACTUACION_clean'].isin(matched_keys)]
        unmatched_temm = df_temm_month[df_temm_month['SEC_ACTUACION_clean'].isin(temm_only)]

        matched_amount = matched_latcom['TransactionAmountUSD'].sum()
        unmatched_amount = unmatched_temm['ImpUSD'].sum()

        print(f'\n   💰 Matched amount: ${matched_amount:,.2f} USD')
        print(f'   💰 Unmatched amount (failed): ${unmatched_amount:,.2f} USD')
        print(f'   💰 Difference: ${unmatched_amount:,.2f} USD')

        # Store results
        results_by_month[month_num] = {
            'month_name': month_name,
            'temm_data': df_temm_month,
            'latcom_adjusted': df_latcom_adjusted,
            'matched': matched_latcom,
            'unmatched_temm': unmatched_temm,
            'latcom_only': df_latcom_adjusted[df_latcom_adjusted['VENDOR_TRANSACTION_ID_clean'].isin(latcom_only)]
        }

# Step 4: Create output Excel
print('\n' + '=' * 100)
print('CREATING OUTPUT EXCEL')
print('=' * 100)

with pd.ExcelWriter(OUTPUT_FILE, engine='xlsxwriter') as writer:
    workbook = writer.book

    # Format definitions
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#4472C4',
        'font_color': 'white',
        'border': 1
    })

    matched_format = workbook.add_format({
        'bg_color': '#C6EFCE',
        'border': 1
    })

    unmatched_format = workbook.add_format({
        'bg_color': '#FFC7CE',
        'border': 1
    })

    # Summary sheet
    summary_data = []
    for month_num in sorted(results_by_month.keys()):
        result = results_by_month[month_num]
        summary_data.append({
            'Month': result['month_name'],
            'Telefonica Claims': len(result['temm_data']),
            'Telefonica Amount USD': result['temm_data']['ImpUSD'].sum(),
            'Latcom Reported': len(result['latcom_adjusted']),
            'Latcom Amount USD': result['latcom_adjusted']['TransactionAmountUSD'].sum(),
            'Matched': len(result['matched']),
            'Matched Amount USD': result['matched']['TransactionAmountUSD'].sum(),
            'Failed (Unmatched)': len(result['unmatched_temm']),
            'Failed Amount USD': result['unmatched_temm']['ImpUSD'].sum(),
            'Difference USD': result['unmatched_temm']['ImpUSD'].sum()
        })

    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name='SUMMARY', index=False)

    # Format summary sheet
    worksheet = writer.sheets['SUMMARY']
    for col_num, value in enumerate(df_summary.columns.values):
        worksheet.write(0, col_num, value, header_format)

    # Individual month sheets
    for month_num in sorted(results_by_month.keys()):
        result = results_by_month[month_num]
        month_name = result['month_name'][:3].upper()  # SEP, OCT, NOV, DEC

        # Telefonica data
        result['temm_data'].to_excel(writer, sheet_name=f'{month_name}_TELEFONICA', index=False)

        # Latcom adjusted
        result['latcom_adjusted'].to_excel(writer, sheet_name=f'{month_name}_LATCOM_ADJ', index=False)

        # Matched transactions
        result['matched'].to_excel(writer, sheet_name=f'{month_name}_MATCHED', index=False)

        # Failed transactions (in TEMM but not in Latcom)
        failed_df = result['unmatched_temm'].copy()
        failed_df['FAILURE_REASON'] = 'TIMEOUT'  # Default as per meeting discussion
        failed_df.to_excel(writer, sheet_name=f'{month_name}_FAILED', index=False)

print(f'\n✅ Reconciliation complete!')
print(f'📁 Output file: {OUTPUT_FILE}')

# Print totals
print('\n' + '=' * 100)
print('TOTALS FOR 2023 (Months Processed)')
print('=' * 100)

total_telefonica = sum(len(r['temm_data']) for r in results_by_month.values())
total_telefonica_usd = sum(r['temm_data']['ImpUSD'].sum() for r in results_by_month.values())
total_latcom = sum(len(r['latcom_adjusted']) for r in results_by_month.values())
total_latcom_usd = sum(r['latcom_adjusted']['TransactionAmountUSD'].sum() for r in results_by_month.values())
total_matched = sum(len(r['matched']) for r in results_by_month.values())
total_matched_usd = sum(r['matched']['TransactionAmountUSD'].sum() for r in results_by_month.values())
total_failed = sum(len(r['unmatched_temm']) for r in results_by_month.values())
total_failed_usd = sum(r['unmatched_temm']['ImpUSD'].sum() for r in results_by_month.values())

print(f'Telefonica claims: {total_telefonica:,} transactions (${total_telefonica_usd:,.2f} USD)')
print(f'Latcom reported: {total_latcom:,} transactions (${total_latcom_usd:,.2f} USD)')
print(f'Matched: {total_matched:,} transactions (${total_matched_usd:,.2f} USD)')
print(f'Failed: {total_failed:,} transactions (${total_failed_usd:,.2f} USD)')
print(f'Difference: ${total_failed_usd:,.2f} USD')
print(f'\nMatch rate: {(total_matched/total_telefonica*100):.2f}%')
print('\n' + '=' * 100)
